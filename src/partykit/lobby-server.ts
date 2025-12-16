/**
 * PartyKit Lobby Server - Person-centric matchmaking
 *
 * Players join the lobby and see who else is online.
 * Click someone's avatar to request a game, they click back to accept.
 * Also tracks active games that spectators can join.
 */
import type * as Party from "partykit/server";
import type {
  LobbyPlayer,
  GameRequest,
  ActiveGame,
  LobbyClientMessage,
  LobbyServerMessage,
  GameUpdateMessage,
} from "./protocol";

interface ConnectedPlayer {
  id: string;
  name: string;
  clientId: string; // Stable ID across reconnections
}

export default class LobbyServer implements Party.Server {
  private players: Map<string, ConnectedPlayer> = new Map();
  private requests: Map<string, GameRequest> = new Map();
  private activeGames: Map<string, ActiveGame> = new Map();
  private disconnectTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(readonly room: Party.Room) {}

  onConnect(_conn: Party.Connection) {
    // Player not yet joined until they send join_lobby
  }

  onClose(conn: Party.Connection) {
    const player = this.players.get(conn.id);
    if (!player) return;

    // Delay removal by 1 second to allow reconnection (e.g., during refresh)
    const timeout = setTimeout(() => {
      this.players.delete(conn.id);
      this.disconnectTimeouts.delete(conn.id);

      // Cancel any requests involving this player
      const requestsToRemove: string[] = [];
      this.requests.forEach((req, id) => {
        if (req.fromId === conn.id || req.toId === conn.id) {
          requestsToRemove.push(id);
        }
      });
      requestsToRemove.forEach(id => this.requests.delete(id));

      this.broadcastPlayers();
      this.broadcastRequests();
    }, 1000);

    this.disconnectTimeouts.set(conn.id, timeout);
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as LobbyClientMessage;

    switch (msg.type) {
      case "join_lobby":
        this.handleJoinLobby(sender, msg.name, msg.clientId);
        break;
      case "request_game":
        this.handleRequestGame(sender, msg.targetId);
        break;
      case "accept_request":
        this.handleAcceptRequest(sender, msg.requestId);
        break;
      case "cancel_request":
        this.handleCancelRequest(sender, msg.requestId);
        break;
    }
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "POST") {
      const body = (await req.json()) as GameUpdateMessage;

      if (body.type === "game_update") {
        if (body.isActive) {
          this.activeGames.set(body.roomId, {
            roomId: body.roomId,
            players: body.players,
            spectatorCount: body.spectatorCount,
          });
        } else {
          this.activeGames.delete(body.roomId);
        }
        this.broadcastActiveGames();
        return new Response("OK");
      }
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private handleJoinLobby(conn: Party.Connection, name: string, clientId: string) {
    // Check if this clientId is already connected (deduplication)
    const existingPlayer = [...this.players.entries()].find(
      ([_, p]) => p.clientId === clientId
    );

    if (existingPlayer) {
      const [oldConnId, oldPlayer] = existingPlayer;
      // Remove old connection entry
      this.players.delete(oldConnId);
      // Cancel any pending disconnect timeout for the old connection
      const oldTimeout = this.disconnectTimeouts.get(oldConnId);
      if (oldTimeout) {
        clearTimeout(oldTimeout);
        this.disconnectTimeouts.delete(oldConnId);
      }
    }

    // Cancel disconnect timeout for this connection if it exists
    const existingTimeout = this.disconnectTimeouts.get(conn.id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.disconnectTimeouts.delete(conn.id);
    }

    const player: ConnectedPlayer = {
      id: conn.id,
      name: name.trim() || `Player${conn.id.slice(0, 4)}`,
      clientId,
    };

    this.players.set(conn.id, player);

    // Send welcome with their ID
    this.send(conn, { type: "lobby_joined", playerId: conn.id });

    // Send current state
    this.send(conn, { type: "players", players: this.getPlayerList() });
    this.send(conn, { type: "requests", requests: this.getRequestList() });
    this.send(conn, { type: "active_games", games: this.getActiveGamesList() });

    // Broadcast updated player list to everyone
    this.broadcastPlayers();
  }

  private handleRequestGame(conn: Party.Connection, targetId: string) {
    const fromPlayer = this.players.get(conn.id);
    const toPlayer = this.players.get(targetId);

    if (!fromPlayer || !toPlayer) {
      this.send(conn, { type: "error", message: "Player not found" });
      return;
    }

    if (conn.id === targetId) {
      this.send(conn, {
        type: "error",
        message: "Cannot request game with yourself",
      });
      return;
    }

    // Check if there's already a request from target to us (mutual request = instant match)
    const mutualRequest = this.findRequest(targetId, conn.id);
    if (mutualRequest) {
      this.startGame(mutualRequest, toPlayer, fromPlayer);
      return;
    }

    // Check if we already sent a request to this person
    const existingRequest = this.findRequest(conn.id, targetId);
    if (existingRequest) {
      // Cancel it (toggle behavior)
      this.requests.delete(existingRequest.id);
      this.broadcastRequests();
      return;
    }

    // Create new request
    const request: GameRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromId: conn.id,
      toId: targetId,
    };

    this.requests.set(request.id, request);
    this.broadcastRequests();
  }

  private handleAcceptRequest(conn: Party.Connection, requestId: string) {
    const request = this.requests.get(requestId);
    if (!request) {
      this.send(conn, { type: "error", message: "Request not found" });
      return;
    }

    // Only the target can accept
    if (request.toId !== conn.id) {
      this.send(conn, { type: "error", message: "Cannot accept this request" });
      return;
    }

    const fromPlayer = this.players.get(request.fromId);
    const toPlayer = this.players.get(request.toId);

    if (!fromPlayer || !toPlayer) {
      this.send(conn, { type: "error", message: "Player left" });
      this.requests.delete(requestId);
      this.broadcastRequests();
      return;
    }

    this.startGame(request, fromPlayer, toPlayer);
  }

  private handleCancelRequest(conn: Party.Connection, requestId: string) {
    const request = this.requests.get(requestId);
    if (!request) return;

    // Only the sender can cancel
    if (request.fromId !== conn.id) return;

    this.requests.delete(requestId);
    this.broadcastRequests();
  }

  private startGame(
    request: GameRequest,
    player1: ConnectedPlayer,
    player2: ConnectedPlayer,
  ) {
    // Generate room ID
    const roomId = this.generateRoomId();

    // Remove the request
    this.requests.delete(request.id);

    // Cancel any other requests involving these players
    const requestsToRemove: string[] = [];
    this.requests.forEach((req, id) => {
      if (
        req.fromId === player1.id ||
        req.toId === player1.id ||
        req.fromId === player2.id ||
        req.toId === player2.id
      ) {
        requestsToRemove.push(id);
      }
    });
    requestsToRemove.forEach(id => this.requests.delete(id));

    // Notify both players
    const conn1 = this.room.getConnection(player1.id);
    const conn2 = this.room.getConnection(player2.id);

    if (conn1) {
      this.send(conn1, {
        type: "game_matched",
        roomId,
        opponentName: player2.name,
      });
    }

    if (conn2) {
      this.send(conn2, {
        type: "game_matched",
        roomId,
        opponentName: player1.name,
      });
    }

    // Broadcast updated state
    this.broadcastPlayers();
    this.broadcastRequests();
  }

  private findRequest(fromId: string, toId: string): GameRequest | undefined {
    for (const req of this.requests.values()) {
      if (req.fromId === fromId && req.toId === toId) {
        return req;
      }
    }
    return undefined;
  }

  private generateRoomId(): string {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    return Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  }

  private getPlayerList(): LobbyPlayer[] {
    return [...this.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      clientId: p.clientId,
    }));
  }

  private getRequestList(): GameRequest[] {
    return [...this.requests.values()];
  }

  private getActiveGamesList(): ActiveGame[] {
    return [...this.activeGames.values()];
  }

  private broadcastPlayers() {
    this.broadcast({ type: "players", players: this.getPlayerList() });
  }

  private broadcastRequests() {
    this.broadcast({ type: "requests", requests: this.getRequestList() });
  }

  private broadcastActiveGames() {
    this.broadcast({ type: "active_games", games: this.getActiveGamesList() });
  }

  private send(conn: Party.Connection, msg: LobbyServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: LobbyServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}
