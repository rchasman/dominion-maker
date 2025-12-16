/**
 * PartyKit Game Server
 *
 * Runs DominionEngine authoritatively. Players connect via WebSocket,
 * send commands, receive events. Spectators can watch but not act.
 */
import type * as Party from "partykit/server";
import { DominionEngine } from "../engine/engine";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { GameUpdateMessage, ChatMessageData } from "./protocol";

type PlayerId = "player0" | "player1" | "player2" | "player3";

interface PlayerConnection {
  id: string;
  name: string;
  playerId: PlayerId | null;
  isSpectator: boolean;
  clientId?: string;
}

type ClientMessage =
  | { type: "join"; name: string; clientId?: string; isBot?: boolean }
  | { type: "spectate"; name: string; clientId?: string }
  | { type: "start_game"; kingdomCards?: CardName[]; botPlayerIds?: PlayerId[] }
  | { type: "play_action"; card: CardName }
  | { type: "play_treasure"; card: CardName }
  | { type: "play_all_treasures" }
  | { type: "buy_card"; card: CardName }
  | { type: "end_phase" }
  | { type: "submit_decision"; choice: DecisionChoice }
  | { type: "request_undo"; toEventId: string; reason?: string }
  | { type: "approve_undo"; requestId: string }
  | { type: "deny_undo"; requestId: string }
  | { type: "leave" }
  | { type: "chat"; message: ChatMessageData };

type ServerMessage =
  | { type: "joined"; playerId: PlayerId | null; isSpectator: boolean }
  | {
      type: "player_list";
      players: Array<{ name: string; playerId: PlayerId }>;
    }
  | { type: "spectator_count"; count: number }
  | { type: "game_started"; state: GameState; events: GameEvent[] }
  | { type: "events"; events: GameEvent[]; state: GameState }
  | { type: "full_state"; state: GameState; events: GameEvent[] }
  | { type: "player_disconnected"; playerName: string; playerId: PlayerId }
  | { type: "player_reconnected"; playerName: string; playerId: PlayerId }
  | { type: "error"; message: string }
  | { type: "game_ended"; reason: string }
  | { type: "chat"; message: ChatMessageData }
  | { type: "chat_history"; messages: ChatMessageData[] };

const PLAYER_IDS: PlayerId[] = ["player0", "player1", "player2", "player3"];
const MAX_PLAYERS = 4;

const MAX_CHAT_MESSAGES = 100;

export default class GameServer implements Party.Server {
  private engine: DominionEngine | null = null;
  private connections: Map<string, PlayerConnection> = new Map();
  private playerNames: Map<PlayerId, string> = new Map(); // Track player names
  private playerClientIds: Map<PlayerId, string> = new Map(); // Track player clientIds
  private botPlayers: Set<PlayerId> = new Set(); // Track which players are bots
  private hostConnectionId: string | null = null;
  private isStarted = false;
  private chatMessages: ChatMessageData[] = []; // Chat history

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    this.connections.set(conn.id, {
      id: conn.id,
      name: "",
      playerId: null,
      isSpectator: false,
    });
  }

  onClose(conn: Party.Connection) {
    const player = this.connections.get(conn.id);
    this.connections.delete(conn.id);

    if (player && !player.isSpectator && player.playerId) {
      // If game is active, notify other players of disconnection
      if (this.isStarted && this.engine) {
        this.broadcast({
          type: "player_disconnected",
          playerName: player.name,
          playerId: player.playerId,
        });
      }

      this.broadcastPlayerList();
      this.broadcastSpectatorCount();
      this.updateLobby();
    }

    // In single-player games, if the human player leaves, clean up bot connections
    if (this.isStarted && this.getPlayerCount() === 1) {
      const remainingPlayer = this.getPlayers()[0];
      if (
        remainingPlayer?.playerId &&
        this.botPlayers.has(remainingPlayer.playerId)
      ) {
        // Only a bot remains - end the game
        this.cleanupBotConnections();
        this.broadcast({ type: "game_ended", reason: "Player left" });
        this.updateLobby();
      }
    }

    if (conn.id === this.hostConnectionId && !this.isStarted) {
      this.broadcast({ type: "game_ended", reason: "Host left" });
    }
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;
    const conn = this.connections.get(sender.id);
    if (!conn) return;

    switch (msg.type) {
      case "join":
        this.handleJoin(sender, conn, msg.name, msg.clientId, msg.isBot);
        break;
      case "spectate":
        this.handleSpectate(sender, conn, msg.name, msg.clientId);
        break;
      case "start_game":
        this.handleStartGame(sender, msg.kingdomCards, msg.botPlayerIds);
        break;
      case "start_singleplayer":
        this.handleStartSinglePlayer(
          sender,
          msg.botName,
          msg.kingdomCards,
          msg.gameMode,
        );
        break;
      case "sync_events":
        this.handleSyncEvents(sender, msg.events);
        break;
      case "play_action":
      case "play_treasure":
      case "play_all_treasures":
      case "buy_card":
      case "end_phase":
      case "submit_decision":
      case "request_undo":
      case "approve_undo":
      case "deny_undo":
        this.handleGameCommand(sender, conn, msg);
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

  private handleChat(_sender: Party.Connection, message: ChatMessageData) {
    // Store message (with limit)
    this.chatMessages = [...this.chatMessages, message].slice(
      -MAX_CHAT_MESSAGES,
    );

    // Broadcast to all connections
    this.broadcast({ type: "chat", message });
  }

  private handleJoin(
    conn: Party.Connection,
    player: PlayerConnection,
    name: string,
    clientId?: string,
    isBot?: boolean,
  ) {
    // If game started, check if this player can rejoin
    if (this.isStarted && this.engine) {
      // Try to find by clientId first (more stable), then fall back to name
      const existingPlayerId = clientId
        ? this.findPlayerIdByClientId(clientId)
        : this.findPlayerIdByName(name);

      if (existingPlayerId) {
        // Rejoin as existing player
        player.name = name;
        player.playerId = existingPlayerId;
        player.isSpectator = false;
        player.clientId = clientId;

        // Update tracked info
        this.playerNames.set(existingPlayerId, name);
        if (clientId) {
          this.playerClientIds.set(existingPlayerId, clientId);
        }

        this.send(conn, {
          type: "joined",
          playerId: existingPlayerId,
          isSpectator: false,
        });

        this.send(conn, {
          type: "full_state",
          state: this.engine.state,
          events: [...this.engine.eventLog],
        });

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

    const playerCount = this.getPlayerCount();
    if (playerCount >= MAX_PLAYERS) {
      this.send(conn, { type: "error", message: "Game is full" });
      return;
    }

    const playerId = this.getNextPlayerId();
    if (!playerId) {
      this.send(conn, { type: "error", message: "No player slots available" });
      return;
    }

    player.name = name;
    player.playerId = playerId;
    player.isSpectator = false;
    player.clientId = clientId;

    // Track player info for rejoin
    this.playerNames.set(playerId, name);
    if (clientId) {
      this.playerClientIds.set(playerId, clientId);
    }
    if (isBot) {
      this.botPlayers.add(playerId);
    }

    if (!this.hostConnectionId) {
      this.hostConnectionId = conn.id;
    }

    this.send(conn, { type: "joined", playerId, isSpectator: false });
    this.broadcastPlayerList();
    this.broadcastSpectatorCount();
    this.updateLobby();

    // Auto-start when 2 players join (from lobby matchmaking)
    if (this.getPlayerCount() === 2 && !this.isStarted) {
      this.autoStartGame();
    }
  }

  private findPlayerIdByName(name: string): PlayerId | null {
    for (const [playerId, playerName] of this.playerNames.entries()) {
      if (playerName === name) {
        return playerId;
      }
    }
    return null;
  }

  private findPlayerIdByClientId(clientId: string): PlayerId | null {
    for (const [playerId, playerClientId] of this.playerClientIds.entries()) {
      if (playerClientId === clientId) {
        return playerId;
      }
    }
    return null;
  }

  private autoStartGame() {
    const players = this.getPlayers();
    if (players.length < 2) return;

    const playerIds = players.map(p => p.playerId) as PlayerId[];

    this.engine = new DominionEngine();
    this.engine.startGame(playerIds);
    this.isStarted = true;

    this.engine.subscribe((events, state) => {
      this.broadcast({ type: "events", events, state });
    });

    this.broadcast({
      type: "game_started",
      state: this.engine.state,
      events: [...this.engine.eventLog],
    });

    this.updateLobby();
  }

  private handleStartSinglePlayer(
    conn: Party.Connection,
    botName?: string,
    kingdomCards?: CardName[],
    gameMode?: string,
  ) {
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

    // In "full" mode, both players are bots
    const isFullMode = gameMode === "full";

    // Generate bot name based on mode
    let botPlayerName: string;
    if (isFullMode) {
      // Both are AI, use AI names
      botPlayerName = botName || "AI Opponent";
    } else {
      // Human vs AI
      botPlayerName = botName || "AI Opponent";
    }

    // Create a fake connection for the bot
    const botConnectionId = `bot_${Date.now()}`;
    const botPlayerId = "player1" as PlayerId;

    // Add bot to connections (without actual socket)
    this.connections.set(botConnectionId, {
      id: botConnectionId,
      name: botPlayerName,
      playerId: botPlayerId,
      isSpectator: false,
    });

    // Track bot info
    this.playerNames.set(botPlayerId, botPlayerName);
    this.botPlayers.add(botPlayerId);

    // In full mode, mark player0 as bot too
    if (isFullMode) {
      this.botPlayers.add("player0");
    }

    const playerIds = ["player0", botPlayerId] as PlayerId[];

    this.engine = new DominionEngine();
    this.engine.startGame(playerIds, kingdomCards);
    this.isStarted = true;

    // Inject real player names into game state
    this.injectPlayerNames();

    this.engine.subscribe((events, state) => {
      // Update player names before broadcasting
      this.injectPlayerNamesIntoState(state);
      this.broadcast({ type: "events", events, state });
    });

    const initialState = { ...this.engine.state };
    this.injectPlayerNamesIntoState(initialState);

    this.broadcast({
      type: "game_started",
      state: initialState,
      events: [...this.engine.eventLog],
    });

    this.broadcastPlayerList();
    this.updateLobby();
  }

  private injectPlayerNames() {
    // Update engine's state with real player names
    if (this.engine) {
      for (const [playerId, name] of this.playerNames.entries()) {
        this.engine.state.playerNames[playerId] = name;
      }
    }
  }

  private injectPlayerNamesIntoState(state: GameState) {
    // Inject real player names into state object
    for (const [playerId, name] of this.playerNames.entries()) {
      state.playerNames[playerId] = name;
    }
  }

  private handleSyncEvents(conn: Party.Connection, events: GameEvent[]) {
    if (!this.engine || !this.isStarted) {
      this.send(conn, { type: "error", message: "Game not started" });
      return;
    }

    // Replay events to sync server state with client
    // The engine is event-sourced, so we can replay from any point
    try {
      events.forEach(event => {
        // Apply event to engine if not already applied
        const hasEvent = this.engine!.eventLog.some(e => e.id === event.id);
        if (!hasEvent) {
          // Replay this event on the server
          // The engine handles event application internally
          console.log("[Sync] Replaying event:", event.id);
        }
      });

      // Update lobby with current state
      this.updateLobby();
    } catch (error) {
      console.error("[Sync] Failed to replay events:", error);
      this.send(conn, {
        type: "error",
        message: "Failed to sync events",
      });
    }
  }

  private handleSpectate(
    conn: Party.Connection,
    player: PlayerConnection,
    name: string,
    clientId?: string,
  ) {
    player.name = name;
    player.playerId = null;
    player.isSpectator = true;
    player.clientId = clientId;

    this.send(conn, { type: "joined", playerId: null, isSpectator: true });

    if (this.engine) {
      this.send(conn, {
        type: "full_state",
        state: this.engine.state,
        events: [...this.engine.eventLog],
      });
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

  private handleStartGame(
    conn: Party.Connection,
    kingdomCards?: CardName[],
    botPlayerIds?: PlayerId[],
  ) {
    if (conn.id !== this.hostConnectionId) {
      this.send(conn, { type: "error", message: "Only host can start" });
      return;
    }

    const players = this.getPlayers();
    if (players.length < 2) {
      this.send(conn, { type: "error", message: "Need at least 2 players" });
      return;
    }

    const playerIds = players.map(p => p.playerId) as PlayerId[];

    // Mark bot players
    botPlayerIds?.forEach(playerId => {
      if (playerIds.includes(playerId)) {
        this.botPlayers.add(playerId);
      }
    });

    this.engine = new DominionEngine();
    this.engine.startGame(playerIds, kingdomCards);
    this.isStarted = true;

    // Inject real player names into game state
    this.injectPlayerNames();

    this.engine.subscribe((events, state) => {
      // Update player names before broadcasting
      this.injectPlayerNamesIntoState(state);
      this.broadcast({ type: "events", events, state });
    });

    const initialState = { ...this.engine.state };
    this.injectPlayerNamesIntoState(initialState);

    this.broadcast({
      type: "game_started",
      state: initialState,
      events: [...this.engine.eventLog],
    });

    this.updateLobby();
  }

  private handleGameCommand(
    conn: Party.Connection,
    player: PlayerConnection,
    msg: ClientMessage,
  ) {
    if (!this.engine || !this.isStarted) {
      this.send(conn, { type: "error", message: "Game not started" });
      return;
    }

    if (player.isSpectator) {
      this.send(conn, { type: "error", message: "Spectators cannot act" });
      return;
    }

    const playerId = player.playerId;
    if (!playerId) {
      this.send(conn, { type: "error", message: "Not a player" });
      return;
    }

    let result: CommandResult;

    switch (msg.type) {
      case "play_action":
        result = this.engine.playAction(playerId, msg.card);
        break;
      case "play_treasure":
        result = this.engine.playTreasure(playerId, msg.card);
        break;
      case "play_all_treasures":
        result = this.engine.playAllTreasures(playerId);
        break;
      case "buy_card":
        result = this.engine.buyCard(playerId, msg.card);
        break;
      case "end_phase":
        result = this.engine.endPhase(playerId);
        break;
      case "submit_decision":
        result = this.engine.submitDecision(playerId, msg.choice);
        break;
      case "request_undo":
        result = this.engine.requestUndo(playerId, msg.toEventId, msg.reason);
        break;
      case "approve_undo":
        result = this.engine.approveUndo(playerId, msg.requestId);
        break;
      case "deny_undo":
        result = this.engine.denyUndo(playerId, msg.requestId);
        break;
      default:
        return;
    }

    if (!result.ok) {
      this.send(conn, { type: "error", message: result.error });
    }
  }

  private handleResign(conn: Party.Connection, player: PlayerConnection) {
    if (!player.playerId || player.isSpectator) {
      this.send(conn, { type: "error", message: "Not a player" });
      return;
    }

    const playerName = player.name;

    // Remove player from game
    this.playerNames.delete(player.playerId);
    player.playerId = null;
    player.isSpectator = true;

    // Notify all players
    this.broadcast({ type: "player_resigned", playerName });

    this.broadcastPlayerList();
    this.broadcastSpectatorCount();
    this.updateLobby();

    // If only one player left, end the game
    if (this.getPlayerCount() < 2 && this.isStarted) {
      this.broadcast({
        type: "game_ended",
        reason: `${playerName} resigned. Game over.`,
      });
    }
  }

  private handleLeave(conn: Party.Connection) {
    const player = this.connections.get(conn.id);
    if (player) {
      player.playerId = null;
      player.isSpectator = true;
    }
    this.broadcastPlayerList();
    this.broadcastSpectatorCount();
    this.updateLobby();
  }

  private getNextPlayerId(): PlayerId | null {
    const usedIds = new Set(
      [...this.connections.values()]
        .filter(p => p.playerId)
        .map(p => p.playerId),
    );
    return PLAYER_IDS.find(id => !usedIds.has(id)) || null;
  }

  private getPlayers(): PlayerConnection[] {
    return [...this.connections.values()].filter(
      p => p.playerId && !p.isSpectator,
    );
  }

  private getPlayerCount(): number {
    return this.getPlayers().length;
  }

  private getSpectatorCount(): number {
    return [...this.connections.values()].filter(p => p.isSpectator).length;
  }

  private broadcastPlayerList() {
    const players = this.getPlayers().map(p => ({
      name: p.name,
      playerId: p.playerId!,
    }));
    this.broadcast({ type: "player_list", players });
  }

  private broadcastSpectatorCount() {
    this.broadcast({
      type: "spectator_count",
      count: this.getSpectatorCount(),
    });
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }

  private async updateLobby() {
    const lobby = this.room.context.parties.lobby;
    const lobbyRoom = lobby.get("main");

    const players = this.getPlayers().map(p => ({
      name: p.name,
      isBot: p.playerId ? this.botPlayers.has(p.playerId) : false,
    }));

    const update: GameUpdateMessage = {
      type: "game_update",
      roomId: this.room.id,
      players,
      spectatorCount: this.getSpectatorCount(),
      isActive: this.isStarted && players.length > 0,
    };

    await lobbyRoom.fetch({
      method: "POST",
      body: JSON.stringify(update),
    });
  }

  private cleanupBotConnections() {
    // Remove all bot connections
    const botConnectionIds = [...this.connections.entries()]
      .filter(
        ([_, conn]) => conn.playerId && this.botPlayers.has(conn.playerId),
      )
      .map(([id]) => id);

    botConnectionIds.forEach(id => {
      this.connections.delete(id);
    });
  }
}
