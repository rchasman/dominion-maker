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
import type { GameUpdateMessage, ChatMessageData, PlayerId } from "./protocol";

interface PlayerConnection {
  id: string;
  name: string;
  clientId: string;
  isSpectator: boolean;
  isBot?: boolean;
}

type ClientMessage =
  | { type: "join"; name: string; clientId?: string; isBot?: boolean }
  | { type: "spectate"; name: string; clientId?: string }
  | { type: "start_game"; kingdomCards?: CardName[]; botPlayerIds?: PlayerId[] }
  | {
      type: "start_singleplayer";
      botName?: string;
      kingdomCards?: CardName[];
      gameMode?: string;
    }
  | { type: "change_game_mode"; gameMode: string }
  | { type: "sync_events"; events: GameEvent[] }
  | { type: "play_action"; card: CardName }
  | { type: "play_treasure"; card: CardName }
  | { type: "play_all_treasures" }
  | { type: "buy_card"; card: CardName }
  | { type: "end_phase" }
  | { type: "submit_decision"; choice: DecisionChoice }
  | { type: "request_undo"; toEventId: string; reason?: string }
  | { type: "approve_undo"; requestId: string }
  | { type: "deny_undo"; requestId: string }
  | { type: "resign" }
  | { type: "leave" }
  | { type: "chat"; message: ChatMessageData };

type ServerMessage =
  | {
      type: "joined";
      playerId: PlayerId | null;
      isSpectator: boolean;
      isHost: boolean;
    }
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

const MAX_PLAYERS = 2;

const MAX_CHAT_MESSAGES = 100;

export default class GameServer implements Party.Server {
  private engine: DominionEngine | null = null;
  private connections: Map<string, PlayerConnection> = new Map();
  private botPlayers: Set<PlayerId> = new Set(); // Track which players are bots (by clientId)
  private hostConnectionId: string | null = null;
  private hostClientId: string | null = null;
  private isStarted = false;
  private chatMessages: ChatMessageData[] = []; // Chat history
  private playerInfo: Record<
    PlayerId,
    { id: PlayerId; name: string; type: "human" | "ai"; connected: boolean }
  > = {}; // Track player info separately from engine state

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    this.connections.set(conn.id, {
      id: conn.id,
      name: "",
      clientId: "",
      isSpectator: false,
    });
  }

  onClose(conn: Party.Connection) {
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
      this.updateLobby();
    }

    // In single-player games, only end if no humans remain (including spectators)
    // Exception: full mode (AI vs AI) should continue even without humans
    if (this.isStarted && this.getPlayerCount() === 1) {
      const remainingPlayer = this.getPlayers()[0];
      if (
        remainingPlayer?.clientId &&
        this.botPlayers.has(remainingPlayer.clientId)
      ) {
        // Only a bot remains as player - check if this should end the game
        const humanCount = this.getHumanConnectionCount();

        // End game only if no humans remain AND not in full mode
        if (humanCount === 0 && !this.isFullMode()) {
          this.cleanupBotConnections();
          this.endGame("Player left");
        }
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
      case "change_game_mode":
        this.handleChangeGameMode(sender, msg.gameMode);
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
      console.log(
        `[Rejoin] Attempt by ${name} (${clientId}), playerInfo keys:`,
        Object.keys(this.playerInfo),
      );

      // Try to find by clientId first (more stable), then fall back to name
      const existingPlayerId = clientId
        ? this.findPlayerIdByClientId(clientId)
        : this.findPlayerIdByName(name);

      console.log(`[Rejoin] Found existingPlayerId:`, existingPlayerId);

      if (existingPlayerId) {
        // Rejoin as existing player
        player.name = name;
        player.clientId = existingPlayerId; // ClientId is the playerId
        player.isSpectator = false;

        // Update name in playerInfo
        if (this.playerInfo[existingPlayerId]) {
          this.playerInfo[existingPlayerId].name = name;
          this.playerInfo[existingPlayerId].connected = true;
        }

        this.send(conn, {
          type: "joined",
          playerId: existingPlayerId,
          isSpectator: false,
          isHost: this.hostClientId === existingPlayerId,
        });

        // Send full state with playerInfo included
        const stateWithPlayerInfo = {
          ...this.engine.state,
          playerInfo: this.playerInfo,
        };
        this.send(conn, {
          type: "full_state",
          state: stateWithPlayerInfo,
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

    // Require clientId for non-bot players
    if (!clientId && !isBot) {
      this.send(conn, { type: "error", message: "clientId required" });
      return;
    }

    const actualClientId = clientId || crypto.randomUUID();

    const playerCount = this.getPlayerCount();
    if (playerCount >= MAX_PLAYERS) {
      this.send(conn, { type: "error", message: "Game is full" });
      return;
    }

    // Use clientId directly as playerId
    player.name = name;
    player.clientId = actualClientId;
    player.isSpectator = false;
    player.isBot = isBot;

    if (isBot) {
      this.botPlayers.add(actualClientId);
    }

    // Set host on first join
    if (!this.hostConnectionId) {
      this.hostConnectionId = conn.id;
      this.hostClientId = actualClientId;
    }

    this.send(conn, {
      type: "joined",
      playerId: actualClientId,
      isSpectator: false,
      isHost: this.hostClientId === actualClientId,
    });
    this.broadcastPlayerList();
    this.broadcastSpectatorCount();
    this.updateLobby();

    // Auto-start when 2 players join (from lobby matchmaking)
    if (this.getPlayerCount() === 2 && !this.isStarted) {
      this.autoStartGame();
    }
  }

  private findPlayerIdByName(name: string): PlayerId | null {
    for (const [clientId, info] of Object.entries(this.playerInfo)) {
      if (info.name === name) return clientId;
    }
    return null;
  }

  private findPlayerIdByClientId(clientId: string): PlayerId | null {
    // ClientId IS the playerId now
    return this.playerInfo[clientId] ? clientId : null;
  }

  private autoStartGame() {
    const players = this.getPlayers();
    if (players.length < 2) return;

    console.log(
      "[AutoStart] Players:",
      players.map(p => `${p.name} (${p.clientId})`),
    );

    const playerIds = players.map(p => p.clientId);

    this.engine = new DominionEngine();
    this.engine.startGame(playerIds);
    this.isStarted = true;

    // Populate playerInfo with real player data
    this.playerInfo = {};
    for (const p of players) {
      this.playerInfo[p.clientId] = {
        id: p.clientId,
        name: p.name,
        type: p.isBot ? "ai" : "human",
        connected: true,
      };
      console.log(`[AutoStart] playerInfo[${p.clientId}].name = "${p.name}"`);
    }

    console.log(
      "[AutoStart] Broadcasting state with playerInfo:",
      Object.keys(this.playerInfo),
    );

    this.engine.subscribe((events, state) => {
      const stateWithPlayerInfo = {
        ...state,
        playerInfo: this.playerInfo,
      };
      this.broadcast({ type: "events", events, state: stateWithPlayerInfo });
      if (state.gameOver) {
        this.updateLobby();
      }
    });

    const stateWithPlayerInfo = {
      ...this.engine.state,
      playerInfo: this.playerInfo,
    };
    this.broadcast({
      type: "game_started",
      state: stateWithPlayerInfo,
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
    const botPlayerName = botName || "AI Opponent";

    // Create bot with real UUID
    const botClientId = crypto.randomUUID();
    const botConnectionId = `conn_${botClientId}`;

    // Add bot to connections (without actual socket)
    this.connections.set(botConnectionId, {
      id: botConnectionId,
      name: botPlayerName,
      clientId: botClientId,
      isSpectator: false,
      isBot: true,
    });

    this.botPlayers.add(botClientId);

    // In full mode, mark human player as bot too
    const humanPlayer = players[0];
    if (isFullMode) {
      this.botPlayers.add(humanPlayer.clientId);
    }

    const playerIds = [humanPlayer.clientId, botClientId];

    this.engine = new DominionEngine();
    this.engine.startGame(playerIds, kingdomCards);
    this.isStarted = true;

    // Populate playerInfo with real player data
    this.playerInfo = {};
    this.playerInfo[humanPlayer.clientId] = {
      id: humanPlayer.clientId,
      name: humanPlayer.name,
      type: isFullMode ? "ai" : "human",
      connected: true,
    };
    this.playerInfo[botClientId] = {
      id: botClientId,
      name: botPlayerName,
      type: "ai",
      connected: true,
    };

    this.engine.subscribe((events, state) => {
      const stateWithPlayerInfo = {
        ...state,
        playerInfo: this.playerInfo,
      };
      this.broadcast({ type: "events", events, state: stateWithPlayerInfo });
      if (state.gameOver) {
        this.updateLobby();
      }
    });

    const stateWithPlayerInfo = {
      ...this.engine.state,
      playerInfo: this.playerInfo,
    };
    this.broadcast({
      type: "game_started",
      state: stateWithPlayerInfo,
      events: [...this.engine.eventLog],
    });

    this.broadcastPlayerList();
    this.updateLobby();
  }

  private handleChangeGameMode(conn: Party.Connection, gameMode: string) {
    // Only allow host to change mode
    if (conn.id !== this.hostConnectionId) {
      this.send(conn, { type: "error", message: "Only host can change mode" });
      return;
    }

    // Only allow in single-player games
    if (this.getPlayerCount() !== 2 || this.botPlayers.size === 0) {
      this.send(conn, {
        type: "error",
        message: "Mode change only allowed in single-player",
      });
      return;
    }

    const isFullMode = gameMode === "full";

    // Update bot status based on mode
    const players = this.getPlayers();
    if (players.length === 2) {
      const [player1, player2] = players;
      if (isFullMode) {
        // Mark both players as bots
        this.botPlayers.add(player1.clientId);
        this.botPlayers.add(player2.clientId);
      } else {
        // Only the bot opponent is marked as bot
        const humanPlayer = players.find(p => !p.isBot);
        const botPlayer = players.find(p => p.isBot);
        if (humanPlayer) this.botPlayers.delete(humanPlayer.clientId);
        if (botPlayer) this.botPlayers.add(botPlayer.clientId);
      }
    }

    // Notify lobby of the change
    this.updateLobby();
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
    player.clientId = clientId || crypto.randomUUID();
    player.isSpectator = true;

    this.send(conn, {
      type: "joined",
      playerId: null,
      isSpectator: true,
      isHost: false,
    });

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

    const playerIds = players.map(p => p.clientId);

    // Mark bot players
    botPlayerIds?.forEach(clientId => {
      if (playerIds.includes(clientId)) {
        this.botPlayers.add(clientId);
      }
    });

    this.engine = new DominionEngine();
    this.engine.startGame(playerIds, kingdomCards);
    this.isStarted = true;

    // Populate playerInfo with real player data
    this.playerInfo = {};
    for (const p of players) {
      this.playerInfo[p.clientId] = {
        id: p.clientId,
        name: p.name,
        type: p.isBot ? "ai" : "human",
        connected: true,
      };
    }

    this.engine.subscribe((events, state) => {
      const stateWithPlayerInfo = {
        ...state,
        playerInfo: this.playerInfo,
      };
      this.broadcast({ type: "events", events, state: stateWithPlayerInfo });
      if (state.gameOver) {
        this.updateLobby();
      }
    });

    const stateWithPlayerInfo = {
      ...this.engine.state,
      playerInfo: this.playerInfo,
    };
    this.broadcast({
      type: "game_started",
      state: stateWithPlayerInfo,
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

    const playerId = player.clientId;
    if (!playerId || player.isSpectator) {
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
    this.updateLobby();

    // If only one player left, end the game
    if (this.getPlayerCount() < 2 && this.isStarted) {
      this.endGame(`${playerName} resigned. Game over.`);
    }
  }

  private endGame(reason: string) {
    this.isStarted = false;
    this.engine = null;
    this.playerInfo = {};
    this.botPlayers.clear();
    this.hostConnectionId = null;
    this.hostClientId = null;
    this.broadcast({ type: "game_ended", reason });
    this.updateLobby();
  }

  private handleLeave(conn: Party.Connection) {
    const player = this.connections.get(conn.id);
    if (!player) return;

    const wasPlayer = player.clientId && !player.isSpectator;

    // Keep clientId but mark as spectator
    player.isSpectator = true;

    this.broadcastPlayerList();
    this.broadcastSpectatorCount();

    // If a player left a single-player game, end it immediately
    if (wasPlayer && this.isStarted) {
      const remainingPlayers = this.getPlayers();

      // Check if only bots remain or it's a single-player game
      const onlyBotsRemain = remainingPlayers.every(
        p => p.clientId && this.botPlayers.has(p.clientId),
      );

      if (onlyBotsRemain && !this.isFullMode()) {
        // Single-player game abandoned - clean it up
        this.cleanupBotConnections();
        this.endGame("Player left");
        return;
      }
    }

    this.updateLobby();
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
      return conn.clientId && !this.botPlayers.has(conn.clientId);
    }).length;
  }

  private isFullMode(): boolean {
    // Full mode is when all players are marked as bots
    // This indicates an AI vs AI game that should continue autonomously
    const players = this.getPlayers();
    return (
      players.length > 0 && players.every(p => this.botPlayers.has(p.clientId))
    );
  }

  private broadcastPlayerList() {
    const players = this.getPlayers().map(p => ({
      name: p.name,
      playerId: p.clientId,
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

    // Get all players from playerInfo
    const players = Object.entries(this.playerInfo).map(([clientId, info]) => {
      // Check if this player has an active connection
      const activeConnection = [...this.connections.values()].find(
        conn => conn.clientId === clientId && !conn.isSpectator,
      );

      return {
        name: info.name,
        isBot: this.botPlayers.has(clientId),
        isConnected: !!activeConnection,
      };
    });

    const update: GameUpdateMessage = {
      type: "game_update",
      roomId: this.room.id,
      players,
      spectatorCount: this.getSpectatorCount(),
      isActive:
        this.isStarted &&
        players.length > 0 &&
        !(this.engine?.state.gameOver ?? false),
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
        ([_, conn]) => conn.clientId && this.botPlayers.has(conn.clientId),
      )
      .map(([id]) => id);

    botConnectionIds.forEach(id => {
      this.connections.delete(id);
    });
  }
}
