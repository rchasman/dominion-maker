/**
 * PartyKit Game Server
 *
 * Runs one registered game authoritatively. The first `join` fixes the room's
 * `GameModule`; everything game-specific (rules, schemas, privacy view) flows
 * through it. Players connect via WebSocket, send commands, receive events.
 * Spectators can watch but not act.
 */
import type * as Party from "partykit/server";
import type { z } from "zod";
import { gameMessageSchema, parseMessage } from "../validation/messages";
import type { GameShape } from "../core/game-definition";
import type { EventEngine, GameModule } from "../core/game-module";
import type {
  BotConfig,
  GameServerMessage,
  GameUpdateMessage,
  ChatMessageData,
  PlayerId,
} from "./protocol";
import type { PlayerInfoEntry } from "../types/player-info";
import type { LLMLogEntryInput } from "../core/consensus/types";
import type { ControllerConfig, Seats } from "../core/seats";
import { HUMAN_SEAT, isHumanSeat } from "../core/seats";
import type { Controller } from "../core/controller";
import { heuristicController } from "../core/controller";
import { llmController, type DecideMove } from "../core/llm-controller";
import { stampLogEntry } from "../core/consensus/log";
import { createControllerCache } from "../core/controller-cache";
import { driveEngine } from "../core/driver";
import { httpDecideMove } from "../agent/http-decide-move";
import { moduleFor } from "../games";
import type { GameId } from "../game-ids";

/** One event as the room handles it: opaque apart from the id it is sliced by */
type RoomEvent = GameShape["event"];

type RoomModule = GameModule<GameShape>;

/** How a game id becomes a module; tests pass their own registry */
export type ResolveModule = (id: GameId) => RoomModule;

/** How a seat's models are reached; tests pass their own transport */
export type ResolveDecideMove = (module: RoomModule) => DecideMove<GameShape>;

/** The game this room plays, fixed by the first join */
type RoomGame = {
  id: GameId;
  module: RoomModule;
  controllerFor: (
    config: ControllerConfig,
    player: string,
  ) => Controller<GameShape> | null;
};

/** The non-state half of a server message that ships a projected state */
type StateHead =
  | {
      type: "game_started" | "events" | "full_state";
      events: readonly RoomEvent[];
    }
  | { type: "preview_state"; eventId: string };

interface PlayerConnection {
  id: string;
  name: string;
  clientId: string;
  isSpectator: boolean;
  isBot?: boolean | undefined;
}

/** What the server needs from a connection; tests supply a plain object */
export type ConnLike = Pick<Party.Connection, "id" | "send" | "close">;

/** What the server needs from the room; tests supply a plain object */
export type RoomLike = {
  id: string;
  env: Record<string, unknown>;
  getConnections(): Iterable<ConnLike>;
  broadcast(message: string): void;
  context: {
    parties: Record<
      string,
      { get(id: string): { fetch(init: RequestInit): Promise<Response> } }
    >;
  };
};

const MAX_PLAYERS = 2;

const MAX_CHAT_MESSAGES = 100;

const firstIssue = (error: z.ZodError): string =>
  error.issues[0]?.message ?? "Invalid input";

const playerEntry = (
  id: string,
  name: string,
  seat: ControllerConfig | undefined,
): [string, PlayerInfoEntry] => [
  id,
  { id, name, type: isHumanSeat(seat) ? "human" : "ai", connected: true },
];

export default class GameServer implements Party.Server {
  private game: RoomGame | null = null;
  private engine: EventEngine<GameShape> | null = null;
  private connections: Map<string, PlayerConnection> = new Map();
  /** Who controls each seat, keyed by player id */
  private seats: Seats = {};
  private driving: Promise<void> | null = null;
  private driveAbort: AbortController | null = null;
  private readonly apiOrigin: string;
  private hostConnectionId: string | null = null;
  private hostClientId: string | null = null;
  private isStarted = false;
  private localMirror = false;
  private reconnectTokens = new Map<string, string>();
  private chatMessages: ChatMessageData[] = []; // Chat history
  private playerInfo: Record<PlayerId, PlayerInfoEntry> = {}; // Track player info separately from engine state
  private spectatorTimeoutId: ReturnType<typeof setTimeout> | null = null; // Timeout for kicking spectators

  readonly room: RoomLike;
  private readonly resolveModule: ResolveModule;
  private readonly resolveDecideMove: ResolveDecideMove;

  constructor(
    room: RoomLike,
    resolveModule: ResolveModule = moduleFor,
    resolveDecideMove?: ResolveDecideMove,
  ) {
    this.room = room;
    this.resolveModule = resolveModule;
    this.apiOrigin =
      typeof room.env["API_ORIGIN"] === "string" ? room.env["API_ORIGIN"] : "";
    this.resolveDecideMove =
      resolveDecideMove ?? (module => httpDecideMove(module, this.apiOrigin));
  }

  /**
   * The room plays one game: the first joiner picks it, everyone else must
   * name the same one.
   */
  private useGame(conn: ConnLike, id: GameId): RoomGame | null {
    const current = this.game;
    if (current) {
      if (current.id === id) return current;
      this.send(conn, {
        type: "error",
        message: `This room is playing ${current.module.name}`,
      });
      return null;
    }
    const module = this.resolveModule(id);
    const game: RoomGame = {
      id,
      module,
      controllerFor: createControllerCache<GameShape>(config => {
        if (config.kind === "human") return null;
        if (config.kind === "heuristic")
          return heuristicController(module.definition);
        return llmController(module.definition, config, {
          decideMove: this.resolveDecideMove(module),
          getPlayerStrategies: () => ({}),
          logger: entry => this.relayConsensusLog(entry),
        });
      }),
    };
    this.game = game;
    return game;
  }

  /** Bots wait for nobody: whenever a non-human seat must act, drive it */
  private driveBots(): void {
    const engine = this.engine;
    const game = this.game;
    if (this.localMirror || !engine || !game || !this.isStarted || this.driving)
      return;
    const next = game.module.definition.whoMustAct(engine.state);
    if (next === null || isHumanSeat(this.seats[next])) return;
    const abort = new AbortController();
    this.driveAbort = abort;
    this.driving = driveEngine(engine, {
      game: game.module.definition,
      getSeats: () => this.seats,
      controllerFor: game.controllerFor,
      stepDelayMs: 0,
      signal: abort.signal,
      logError: message => console.error(`[GameServer] ${message}`),
    }).finally(() => {
      this.driving = null;
      if (this.driveAbort === abort) this.driveAbort = null;
      if (this.engine === engine && !abort.signal.aborted) this.driveBots();
    });
  }

  /** Resolves when the current bot run ends; null when no bot is acting */
  get botsDriving(): Promise<void> | null {
    return this.driving;
  }

  /** True once nobody may act again; the lobby stops listing a finished game */
  private isFinished(): boolean {
    const engine = this.engine;
    const game = this.game;
    if (!engine || !game) return false;
    return game.module.definition.whoMustAct(engine.state) === null;
  }

  onConnect(conn: Party.Connection) {
    this.connect(conn);
  }

  connect(conn: ConnLike) {
    this.connections.set(conn.id, {
      id: conn.id,
      name: "",
      clientId: "",
      isSpectator: false,
    });
  }

  onClose(conn: Party.Connection) {
    this.disconnect(conn);
  }

  disconnect(conn: ConnLike) {
    const player = this.connections.get(conn.id);
    this.connections.delete(conn.id);

    if (player && !player.isSpectator && player.clientId) {
      // If game is active, notify other players of disconnection
      if (this.isStarted && this.engine) {
        this.broadcast({
          type: "player_disconnected",
          playerName: player.name,
          playerId: player.clientId,
        });
      }

      this.broadcastPlayerList();
      this.broadcastSpectatorCount();
      void this.updateLobby();
    }

    // In single-player games, only end if no humans remain (including spectators)
    // Exception: full mode (AI vs AI) should continue even without humans
    if (this.isStarted && this.getPlayerCount() === 1) {
      const remainingPlayer = this.getPlayers()[0];
      if (remainingPlayer?.isBot) {
        // Only a bot remains as player - check if this should end the game
        const humanCount = this.getHumanConnectionCount();

        // End game only if no humans remain AND not every seat is a bot
        if (humanCount === 0 && !this.allSeatsNonHuman()) {
          this.cleanupBotConnections();
          this.endGame("Player left");
        }
      }
    }

    // CRITICAL FIX: End game immediately when all players disconnect
    // One player can wait indefinitely, but zero means game is dead
    if (this.isStarted && this.getPlayerCount() === 0) {
      const spectatorCount = this.getSpectatorCount();
      if (spectatorCount > 0) {
        // Spectators remain - schedule their cleanup after 5 minutes
        this.scheduleSpectatorTimeout();
      }
      this.endGame("All players disconnected");
    }

    if (conn.id === this.hostConnectionId && !this.isStarted) {
      this.broadcast({ type: "game_ended", reason: "Host left" });
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    this.handleMessage(message, sender);
  }

  handleMessage(message: string, sender: ConnLike) {
    const msg = parseMessage(message, gameMessageSchema);
    if (!msg) {
      this.send(sender, { type: "error", message: "Invalid message" });
      return;
    }
    const conn = this.connections.get(sender.id);
    if (!conn) return;

    switch (msg.type) {
      case "join":
        this.handleJoin(
          sender,
          conn,
          msg.game,
          msg.name,
          msg.clientId,
          msg.isBot,
          msg.reconnectToken,
        );
        break;
      case "spectate":
        this.handleSpectate(sender, conn, msg.game, msg.name, msg.clientId);
        break;
      case "start_game":
        this.handleStartGame(sender, msg.options, msg.bots ?? []);
        break;
      case "start_singleplayer":
        this.handleStartSinglePlayer(sender, msg.seats, msg.options);
        break;
      case "set_seat":
        this.handleSetSeat(sender, conn, msg.playerId, msg.controller);
        break;
      case "sync_events":
        this.handleSyncEvents(sender, msg.events);
        break;
      case "command":
        this.handleGameCommand(sender, conn, msg.command);
        break;
      case "preview_state":
        this.handlePreviewState(sender, msg.eventId);
        break;
      case "resign":
        this.handleResign(sender, conn);
        break;
      case "leave":
        this.handleLeave(sender);
        break;
      case "chat":
        this.handleChat(sender, msg.message);
        break;
    }
  }

  private handlePreviewState(conn: ConnLike, eventId: string) {
    const game = this.game;
    if (!game) return;
    const events = [...(this.engine?.eventLog ?? [])];
    const index = events.findIndex(event => event.id === eventId);
    const prefix = events.slice(0, index + 1);
    if (index < 0) {
      this.sendState(conn, { type: "preview_state", eventId }, null, prefix);
      return;
    }
    try {
      const state = game.module.loadEngine(prefix).state;
      this.sendState(conn, { type: "preview_state", eventId }, state, prefix);
    } catch {
      this.send(conn, { type: "error", message: "Failed to load history" });
    }
  }

  private handleChat(sender: ConnLike, input: ChatMessageData) {
    const player = this.connections.get(sender.id);
    if (!player?.name) return;
    const message = {
      ...input,
      id: crypto.randomUUID(),
      senderName: player.name,
      timestamp: Date.now(),
    };
    // Store message (with limit)
    this.chatMessages = [...this.chatMessages, message].slice(
      -MAX_CHAT_MESSAGES,
    );

    // Broadcast to all connections
    this.broadcast({ type: "chat", message });
  }

  private handleJoin(
    conn: ConnLike,
    player: PlayerConnection,
    gameId: GameId,
    name: string,
    clientId?: string,
    isBot?: boolean,
    reconnectToken?: string,
  ) {
    const knownToken = clientId
      ? this.reconnectTokens.get(clientId)
      : undefined;
    if (knownToken && reconnectToken !== knownToken) {
      this.send(conn, {
        type: "error",
        message: "Reconnect credentials required",
      });
      return;
    }
    if (isBot) {
      this.send(conn, {
        type: "error",
        message: "Bots are created by the host",
      });
      return;
    }
    const engine = this.engine;
    if (this.isStarted && engine) {
      if (!this.useGame(conn, gameId)) return;
      const existingPlayerId =
        clientId && knownToken && this.playerInfo[clientId] ? clientId : null;
      if (existingPlayerId) {
        // Replace any previous socket for this authenticated seat.
        for (const [id, previous] of this.connections) {
          if (
            id !== conn.id &&
            previous.clientId === existingPlayerId &&
            !previous.isSpectator
          )
            this.connections.delete(id);
        }
        if (this.hostClientId === existingPlayerId)
          this.hostConnectionId = conn.id;
        // Rejoin as existing player
        player.name = name;
        player.clientId = existingPlayerId; // ClientId is the playerId
        player.isSpectator = false;

        // Update name in playerInfo
        const info = this.playerInfo[existingPlayerId];
        if (info) {
          info.name = name;
          info.connected = true;
        }

        this.send(conn, {
          type: "joined",
          gameStarted: this.isStarted,
          playerId: existingPlayerId,
          isSpectator: false,
          isHost: this.hostClientId === existingPlayerId,
          ...(knownToken ? { reconnectToken: knownToken } : {}),
        });

        this.sendState(
          conn,
          { type: "full_state", events: engine.eventLog },
          engine.state,
          engine.eventLog,
        );

        // Send chat history
        if (this.chatMessages.length > 0) {
          this.send(conn, {
            type: "chat_history",
            messages: this.chatMessages,
          });
        }

        this.broadcastPlayerList();

        // Notify other players that this player has reconnected
        this.broadcast({
          type: "player_reconnected",
          playerName: name,
          playerId: existingPlayerId,
        });

        return;
      }

      // Can't join as new player once started
      this.send(conn, { type: "error", message: "Game already started" });
      return;
    }

    // Require clientId for non-bot players
    if (!clientId && !isBot) {
      this.send(conn, { type: "error", message: "clientId required" });
      return;
    }

    const actualClientId = clientId || crypto.randomUUID();

    if (knownToken) {
      for (const [id, previous] of this.connections) {
        if (
          id !== conn.id &&
          previous.clientId === actualClientId &&
          !previous.isSpectator
        )
          this.connections.delete(id);
      }
      if (this.hostClientId === actualClientId) this.hostConnectionId = conn.id;
    }
    const playerCount = this.getPlayerCount();
    if (playerCount >= MAX_PLAYERS) {
      this.send(conn, { type: "error", message: "Game is full" });
      return;
    }

    // Only a joiner who gets a seat fixes the room's game
    const game = this.useGame(conn, gameId);
    if (!game) return;

    const token = knownToken ?? crypto.randomUUID();
    this.reconnectTokens.set(actualClientId, token);

    // Use clientId directly as playerId
    player.name = name;
    player.clientId = actualClientId;
    player.isSpectator = false;
    player.isBot = isBot;
    this.seats = { ...this.seats, [actualClientId]: HUMAN_SEAT };

    // Set host on first join
    if (!this.hostConnectionId) {
      this.hostConnectionId = conn.id;
      this.hostClientId = actualClientId;
    }

    this.send(conn, {
      type: "joined",
      gameStarted: this.isStarted,
      playerId: actualClientId,
      isSpectator: false,
      isHost: this.hostClientId === actualClientId,
      reconnectToken: token,
    });
    this.broadcastPlayerList();
    this.broadcastSpectatorCount();
    void this.updateLobby();

    // Auto-start when 2 players join (from lobby matchmaking)
    if (this.getPlayerCount() === 2 && !this.isStarted) {
      this.localMirror = false;
      // A lobby match carries no options: the module's defaults decide the setup
      const accepted = this.acceptOptions(conn, game, {});
      if (accepted) this.startEngine(game, this.getPlayers(), accepted.value);
    }
  }

  private handleStartSinglePlayer(
    conn: ConnLike,
    seats: Seats,
    options: unknown,
  ) {
    const game = this.game;
    if (!game) {
      this.send(conn, { type: "error", message: "Join a game first" });
      return;
    }
    if (conn.id !== this.hostConnectionId) {
      this.send(conn, { type: "error", message: "Only host can start" });
      return;
    }

    if (this.isStarted) {
      this.send(conn, { type: "error", message: "Game already started" });
      return;
    }

    const players = this.getPlayers();
    if (players.length !== 1) {
      this.send(conn, {
        type: "error",
        message: "Single-player requires exactly 1 human player",
      });
      return;
    }

    const accepted = this.acceptOptions(conn, game, options);
    if (!accepted) return;

    // The host's own engine is authoritative; this room only mirrors it for
    // spectators, so seats are labels keyed by the local game's player ids.
    this.localMirror = true;
    const humanPlayer = players[0];
    if (!humanPlayer) return;
    const seatIds = Object.keys(seats);
    const botConnectionId = this.addBotConnection(seatIds[1] ?? "AI Opponent", {
      kind: "heuristic",
    });
    this.seats = seats;

    const engine = game.module.createEngine(
      [humanPlayer.clientId, botConnectionId],
      accepted.value,
    );
    this.engine = engine;
    this.isStarted = true;

    this.playerInfo = Object.fromEntries(
      Object.entries(seats).map(([id, seat]) => playerEntry(id, id, seat)),
    );

    this.subscribe(game, engine);

    this.broadcastState(
      { type: "game_started", events: engine.eventLog },
      engine.state,
      engine.eventLog,
    );
    this.broadcastPlayerList();
    void this.updateLobby();
  }

  private handleSetSeat(
    conn: ConnLike,
    sender: PlayerConnection,
    playerId: PlayerId,
    controller: ControllerConfig,
  ) {
    const isHost = conn.id === this.hostConnectionId;
    if (this.localMirror) {
      if (!isHost) {
        this.send(conn, { type: "error", message: "Not your seat" });
        return;
      }
      this.seats = { ...this.seats, [playerId]: controller };
      const info = this.playerInfo[playerId];
      if (info) info.type = isHumanSeat(controller) ? "human" : "ai";
      this.broadcastPlayerList();
      void this.updateLobby();
      return;
    }

    const ownSeat = !sender.isSpectator && sender.clientId === playerId;
    const humanConnected = this.getPlayers().some(
      p => p.clientId === playerId && !p.isBot,
    );
    if (!ownSeat && !(isHost && !humanConnected)) {
      this.send(conn, { type: "error", message: "Not your seat" });
      return;
    }
    if (!(playerId in this.seats) && !this.playerInfo[playerId]) {
      this.send(conn, { type: "error", message: "Unknown seat" });
      return;
    }
    this.seats = { ...this.seats, [playerId]: controller };
    const info = this.playerInfo[playerId];
    if (info) info.type = isHumanSeat(controller) ? "human" : "ai";
    // A seat that changed hands mid-decision must not finish the old decision
    this.driveAbort?.abort();
    this.broadcastPlayerList();
    void this.updateLobby();
    this.driveBots();
  }

  private handleSyncEvents(conn: ConnLike, rawEvents: unknown[]) {
    const game = this.game;
    const engine = this.engine;
    if (conn.id !== this.hostConnectionId || !this.localMirror || !game) {
      this.send(conn, {
        type: "error",
        message: "Only a local-game host can sync events",
      });
      return;
    }
    if (!engine || !this.isStarted) {
      this.send(conn, { type: "error", message: "Game not started" });
      return;
    }

    const parsed = rawEvents.map(event =>
      game.module.eventSchema.safeParse(event),
    );
    const events = parsed.flatMap(result =>
      result.success ? [result.data] : [],
    );
    if (events.length !== parsed.length) {
      this.send(conn, { type: "error", message: "Failed to sync events" });
      return;
    }

    try {
      // Local-game hosts send a complete snapshot, including rewinds; multiplayer never accepts this path.
      const loaded = game.module.loadEngine(events);
      if (game.module.definition.players(loaded.state).length !== 2)
        throw new Error("Invalid player count");
      engine.loadEvents(events);
      this.broadcastState(
        { type: "full_state", events },
        engine.state,
        engine.eventLog,
      );
      void this.updateLobby();
    } catch {
      this.send(conn, { type: "error", message: "Failed to sync events" });
    }
  }

  private handleSpectate(
    conn: ConnLike,
    player: PlayerConnection,
    gameId: GameId,
    name: string,
    clientId?: string,
  ) {
    // CRITICAL FIX: Block spectators when only 1 player in room
    // Prevents spectating incomplete/waiting games
    const currentPlayerCount = this.getPlayerCount();
    if (currentPlayerCount < 2) {
      this.send(conn, {
        type: "error",
        message: "Cannot spectate - game needs at least 2 players",
      });
      conn.close();
      return;
    }
    if (!this.useGame(conn, gameId)) return;

    player.name = name;
    player.clientId = clientId || crypto.randomUUID();
    player.isSpectator = true;

    this.send(conn, {
      type: "joined",
      gameStarted: this.isStarted,
      playerId: null,
      isSpectator: true,
      isHost: false,
    });

    const engine = this.engine;
    if (engine) {
      this.sendState(
        conn,
        { type: "full_state", events: engine.eventLog },
        engine.state,
        engine.eventLog,
      );
    }

    // Send chat history
    if (this.chatMessages.length > 0) {
      this.send(conn, {
        type: "chat_history",
        messages: this.chatMessages,
      });
    }

    this.broadcastSpectatorCount();
  }

  private addBotConnection(name: string, controller: BotConfig): string {
    const clientId = crypto.randomUUID();
    this.connections.set(`conn_${clientId}`, {
      id: `conn_${clientId}`,
      name,
      clientId,
      isSpectator: false,
      isBot: true,
    });
    this.seats = { ...this.seats, [clientId]: controller };
    return clientId;
  }

  /** Broadcast every accepted batch, and tell the lobby when the game ends */
  private subscribe(game: RoomGame, engine: EventEngine<GameShape>): void {
    engine.subscribe((events, state) => {
      this.broadcastState(
        game.module.needsFullResync(events)
          ? { type: "full_state", events: engine.eventLog }
          : { type: "events", events },
        state,
        engine.eventLog,
      );
      if (game.module.definition.whoMustAct(state) === null)
        void this.updateLobby();
    });
  }

  /**
   * Validated options, or null once the sender has been told why not. Every
   * refusal must happen before the room is changed: a half-started room stays
   * broken for every later attempt.
   */
  private acceptOptions(
    conn: ConnLike,
    game: RoomGame,
    options: unknown,
  ): { value: GameShape["options"] } | null {
    const parsed = game.module.optionsSchema.safeParse(options ?? {});
    if (parsed.success) return { value: parsed.data };
    this.send(conn, { type: "error", message: firstIssue(parsed.error) });
    return null;
  }

  private startEngine(
    game: RoomGame,
    players: PlayerConnection[],
    options: GameShape["options"],
  ): void {
    const engine = game.module.createEngine(
      players.map(p => p.clientId),
      options,
    );
    this.engine = engine;
    this.isStarted = true;

    this.playerInfo = Object.fromEntries(
      players.map(p => playerEntry(p.clientId, p.name, this.seats[p.clientId])),
    );

    this.subscribe(game, engine);

    this.broadcastState(
      { type: "game_started", events: engine.eventLog },
      engine.state,
      engine.eventLog,
    );
    this.broadcastPlayerList();
    void this.updateLobby();
  }

  private handleStartGame(
    conn: ConnLike,
    options: unknown,
    bots: Array<{ name: string; controller: BotConfig }>,
  ) {
    const game = this.game;
    if (!game) {
      this.send(conn, { type: "error", message: "Join a game first" });
      return;
    }
    if (conn.id !== this.hostConnectionId) {
      this.send(conn, { type: "error", message: "Only host can start" });
      return;
    }

    if (this.isStarted && !this.isFinished()) {
      this.send(conn, { type: "error", message: "Game already started" });
      return;
    }
    this.localMirror = false;
    const humans = this.getPlayers();
    const seatCount = humans.length + bots.length;
    if (seatCount < 2) {
      this.send(conn, { type: "error", message: "Need at least 2 players" });
      return;
    }
    if (seatCount > MAX_PLAYERS) {
      this.send(conn, { type: "error", message: "Game is full" });
      return;
    }

    const accepted = this.acceptOptions(conn, game, options);
    if (!accepted) return;

    bots.map(bot => this.addBotConnection(bot.name, bot.controller));
    this.startEngine(game, this.getPlayers(), accepted.value);
    this.driveBots();
  }

  private handleGameCommand(
    conn: ConnLike,
    player: PlayerConnection,
    command: unknown,
  ) {
    const game = this.game;
    const engine = this.engine;
    if (!engine || !game || !this.isStarted) {
      this.send(conn, { type: "error", message: "Game not started" });
      return;
    }

    if (player.isSpectator) {
      this.send(conn, { type: "error", message: "Spectators cannot act" });
      return;
    }

    const playerId = player.clientId;
    if (!playerId) {
      this.send(conn, { type: "error", message: "Not a player" });
      return;
    }

    const parsed = game.module.commandSchema.safeParse(command);
    if (!parsed.success) {
      this.send(conn, { type: "error", message: firstIssue(parsed.error) });
      return;
    }

    const result = engine.dispatch(parsed.data, playerId);
    if (!result.ok) {
      this.send(conn, { type: "error", message: result.error });
      return;
    }

    game.module.afterCommand?.(engine, result.events, this.seats);
    this.driveBots();
  }

  private handleResign(conn: ConnLike, player: PlayerConnection) {
    if (!player.clientId || player.isSpectator) {
      this.send(conn, { type: "error", message: "Not a player" });
      return;
    }

    const playerName = player.name;

    // Remove player from game (convert to spectator)
    if (this.playerInfo[player.clientId]) {
      delete this.playerInfo[player.clientId];
    }
    player.isSpectator = true;

    // Notify all players
    this.broadcast({ type: "player_resigned", playerName });

    this.broadcastPlayerList();
    this.broadcastSpectatorCount();
    void this.updateLobby();

    // If only one player left, end the game
    if (this.getPlayerCount() < 2 && this.isStarted) {
      this.endGame(`${playerName} resigned. Game over.`);
    }
  }

  private endGame(reason: string) {
    this.driveAbort?.abort();
    this.isStarted = false;
    this.engine = null;
    this.playerInfo = {};
    this.seats = {};
    this.hostConnectionId = null;
    this.hostClientId = null;
    this.broadcast({ type: "game_ended", reason });
    void this.updateLobby();
  }

  private handleLeave(conn: ConnLike) {
    const player = this.connections.get(conn.id);
    if (!player) return;

    const wasPlayer = player.clientId && !player.isSpectator;

    // CRITICAL FIX: End game if host leaves pre-game
    if (!this.isStarted && conn.id === this.hostConnectionId) {
      this.broadcast({ type: "game_ended", reason: "Host left" });
      return;
    }

    // Keep clientId but mark as spectator
    player.isSpectator = true;

    this.broadcastPlayerList();
    this.broadcastSpectatorCount();

    // If a player left a game, end it (both single-player and multiplayer)
    if (wasPlayer && this.isStarted) {
      const remainingPlayers = this.getPlayers();

      // Check if only bots remain or it's a single-player game
      const onlyBotsRemain = remainingPlayers.every(p => p.isBot);

      if (onlyBotsRemain && !this.allSeatsNonHuman()) {
        // Single-player game abandoned - clean it up
        this.cleanupBotConnections();
        this.endGame("Player left");
        return;
      }

      // CRITICAL FIX: End multiplayer games when any player leaves
      // Multiplayer games require all human players to continue
      const humanPlayerCount = remainingPlayers.filter(p => !p.isBot).length;

      if (humanPlayerCount < remainingPlayers.length && humanPlayerCount > 0) {
        // This is multiplayer (has non-bot players) and someone left
        this.broadcast({
          type: "player_disconnected",
          playerName: player.name,
          playerId: player.clientId,
        });
        this.endGame(`${player.name} left the game`);
        return;
      }
    }

    void this.updateLobby();
  }

  private getPlayers(): PlayerConnection[] {
    return [...this.connections.values()].filter(
      p => p.clientId && !p.isSpectator,
    );
  }

  private getPlayerCount(): number {
    return this.getPlayers().length;
  }

  private getSpectatorCount(): number {
    return [...this.connections.values()].filter(p => p.isSpectator).length;
  }

  private getHumanConnectionCount(): number {
    return [...this.connections.values()].filter(conn => {
      // Spectators are always human
      if (conn.isSpectator) return true;
      // Non-spectator players who are not bots are human
      return conn.clientId && !conn.isBot;
    }).length;
  }

  /** An all-bot table keeps playing for its spectators */
  private allSeatsNonHuman(): boolean {
    const seats = Object.values(this.seats);
    return seats.length > 0 && seats.every(seat => !isHumanSeat(seat));
  }

  private scheduleSpectatorTimeout() {
    // Clear any existing timeout
    if (this.spectatorTimeoutId) {
      clearTimeout(this.spectatorTimeoutId);
    }

    // Kick spectators after 5 minutes (300000ms) when game ends with no players
    this.spectatorTimeoutId = setTimeout(() => {
      const spectators = [...this.connections.values()].filter(
        c => c.isSpectator,
      );

      // Notify and disconnect all spectators
      for (const spectator of spectators) {
        const conn = [...this.room.getConnections()].find(
          c => c.id === spectator.id,
        );
        if (conn) {
          this.send(conn, {
            type: "error",
            message: "Game ended - spectator session expired",
          });
          conn.close();
        }
      }

      this.spectatorTimeoutId = null;
    }, 300000); // 5 minutes
  }

  private broadcastPlayerList() {
    // A mirror room's seats are keyed by the local game's ids, not by connections
    const players = this.localMirror
      ? Object.entries(this.seats).map(([playerId, seat]) => ({
          name: this.playerInfo[playerId]?.name ?? playerId,
          playerId,
          controller: seat.kind,
        }))
      : this.getPlayers().map(p => ({
          name: p.name,
          playerId: p.clientId,
          controller: (this.seats[p.clientId] ?? HUMAN_SEAT).kind,
        }));
    this.broadcast({ type: "player_list", players });
  }

  private broadcastSpectatorCount() {
    this.broadcast({
      type: "spectator_count",
      count: this.getSpectatorCount(),
    });
  }

  /** Whose eyes this connection sees through; a spectator sees nobody's */
  private viewerFor(conn: ConnLike): string | null {
    const player = this.connections.get(conn.id);
    return player && !player.isSpectator ? player.clientId : null;
  }

  /**
   * One viewer's copy of a state-carrying message: the module decides what
   * this viewer may see, and `seen` is the history that view is built from.
   */
  private sendState(
    conn: ConnLike,
    head: StateHead,
    state: unknown,
    seen: readonly RoomEvent[],
  ) {
    const game = this.game;
    if (!game) return;
    const viewer = this.viewerFor(conn);
    const payload = {
      game: game.id,
      state: state === null ? null : game.module.view(state, seen, viewer),
      playerInfo: this.playerInfo,
    };
    const message =
      head.type === "preview_state"
        ? { type: head.type, eventId: head.eventId, ...payload }
        : {
            type: head.type,
            events: game.module.publicEvents(head.events),
            ...payload,
          };
    conn.send(JSON.stringify(message));
  }

  private broadcastState(
    head: StateHead,
    state: unknown,
    seen: readonly RoomEvent[],
  ) {
    for (const conn of this.room.getConnections())
      this.sendState(conn, head, state, seen);
  }

  /**
   * A room's LLM seats vote on the server, so the votes reach the viewer only
   * if the room sends them. Each connection gets the module's projection.
   */
  private relayConsensusLog(entry: LLMLogEntryInput): void {
    const game = this.game;
    if (!game) return;
    const stamped = stampLogEntry(entry);
    for (const conn of this.room.getConnections()) {
      const projected =
        game.module.viewLogEntry?.(stamped, this.viewerFor(conn)) ?? stamped;
      this.send(conn, { type: "consensus_log", entry: projected });
    }
  }

  private send(conn: ConnLike, msg: GameServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: GameServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }

  private async updateLobby() {
    const game = this.game;
    if (!game) return;
    const lobby = this.room.context.parties.lobby!;
    const lobbyRoom = lobby.get("main");

    // Get all players from playerInfo
    const players = Object.entries(this.playerInfo).map(([clientId, info]) => {
      // Check if this player has an active connection
      const activeConnection = [...this.connections.values()].find(
        conn => conn.clientId === clientId && !conn.isSpectator,
      );

      return {
        name: info.name,
        isBot: !isHumanSeat(this.seats[clientId]),
        isConnected: !!activeConnection,
      };
    });

    const update: GameUpdateMessage = {
      type: "game_update",
      roomId: this.room.id,
      game: game.id,
      players,
      spectatorCount: this.getSpectatorCount(),
      isActive: this.isStarted && players.length > 0 && !this.isFinished(),
      isSinglePlayer: players.some(p => p.isBot),
    };

    try {
      const response = await lobbyRoom.fetch({
        method: "POST",
        body: JSON.stringify(update),
      });
      if (!response.ok) console.warn("Lobby update failed", response.status);
    } catch (error) {
      console.warn("Lobby update failed", error);
    }
  }

  private cleanupBotConnections() {
    // Remove all bot connections
    const botConnectionIds = [...this.connections.entries()]
      .filter(([, conn]) => conn.isBot)
      .map(([id]) => id);

    botConnectionIds.map(id => this.connections.delete(id));
  }
}
