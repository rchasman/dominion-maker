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

type PlayerId = "player0" | "player1" | "player2" | "player3";

interface PlayerConnection {
  id: string;
  name: string;
  playerId: PlayerId | null;
  isSpectator: boolean;
}

interface GameInfo {
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  isStarted: boolean;
  roomId: string;
}

type ClientMessage =
  | { type: "join"; name: string }
  | { type: "spectate"; name: string }
  | { type: "start_game"; kingdomCards?: CardName[] }
  | { type: "play_action"; card: CardName }
  | { type: "play_treasure"; card: CardName }
  | { type: "play_all_treasures" }
  | { type: "buy_card"; card: CardName }
  | { type: "end_phase" }
  | { type: "submit_decision"; choice: DecisionChoice }
  | { type: "request_undo"; toEventId: string; reason?: string }
  | { type: "approve_undo"; requestId: string }
  | { type: "deny_undo"; requestId: string }
  | { type: "leave" };

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
  | { type: "error"; message: string }
  | { type: "game_ended"; reason: string };

const PLAYER_IDS: PlayerId[] = ["player0", "player1", "player2", "player3"];
const MAX_PLAYERS = 4;

export default class GameServer implements Party.Server {
  private engine: DominionEngine | null = null;
  private connections: Map<string, PlayerConnection> = new Map();
  private hostConnectionId: string | null = null;
  private isStarted = false;

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
      this.broadcastPlayerList();
      this.broadcastSpectatorCount();
      this.updateLobby();
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
        this.handleJoin(sender, conn, msg.name);
        break;
      case "spectate":
        this.handleSpectate(sender, conn, msg.name);
        break;
      case "start_game":
        this.handleStartGame(sender, msg.kingdomCards);
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
      case "leave":
        this.handleLeave(sender);
        break;
    }
  }

  private handleJoin(
    conn: Party.Connection,
    player: PlayerConnection,
    name: string,
  ) {
    if (this.isStarted) {
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

    if (!this.hostConnectionId) {
      this.hostConnectionId = conn.id;
    }

    this.send(conn, { type: "joined", playerId, isSpectator: false });
    this.broadcastPlayerList();
    this.broadcastSpectatorCount();
    this.updateLobby();
  }

  private handleSpectate(
    conn: Party.Connection,
    player: PlayerConnection,
    name: string,
  ) {
    player.name = name;
    player.playerId = null;
    player.isSpectator = true;

    this.send(conn, { type: "joined", playerId: null, isSpectator: true });

    if (this.engine) {
      this.send(conn, {
        type: "full_state",
        state: this.engine.state,
        events: [...this.engine.eventLog],
      });
    }

    this.broadcastSpectatorCount();
  }

  private handleStartGame(conn: Party.Connection, kingdomCards?: CardName[]) {
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

    this.engine = new DominionEngine();
    this.engine.startGame(playerIds, kingdomCards);
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

    const info: GameInfo = {
      hostName: this.getHostName(),
      playerCount: this.getPlayerCount(),
      maxPlayers: MAX_PLAYERS,
      isStarted: this.isStarted,
      roomId: this.room.id,
    };

    await lobbyRoom.fetch({
      method: "POST",
      body: JSON.stringify({ type: "update_game", game: info }),
    });
  }

  private getHostName(): string {
    if (!this.hostConnectionId) return "Unknown";
    const host = this.connections.get(this.hostConnectionId);
    return host?.name || "Unknown";
  }
}
