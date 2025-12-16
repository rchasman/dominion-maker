/**
 * PartyKit Lobby Server
 *
 * Central registry of active games. Clients connect to browse available games.
 * Game servers notify lobby when games are created/updated/ended.
 */
import type * as Party from "partykit/server";

interface GameInfo {
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  isStarted: boolean;
  roomId: string;
  lastUpdate: number;
}

type ClientMessage =
  | { type: "subscribe" }
  | { type: "create_game"; hostName: string };

type ServerMessage =
  | { type: "games"; games: GameInfo[] }
  | { type: "game_created"; roomId: string };

type InternalMessage =
  | { type: "update_game"; game: GameInfo }
  | { type: "remove_game"; roomId: string };

const STALE_GAME_MS = 60_000;
const CLEANUP_INTERVAL_MS = 30_000;

export default class LobbyServer implements Party.Server {
  private games: Map<string, GameInfo> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {}

  onStart() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleGames();
    }, CLEANUP_INTERVAL_MS);
  }

  onConnect(conn: Party.Connection) {
    this.sendGamesList(conn);
  }

  onMessage(message: string, sender: Party.Connection) {
    const msg = JSON.parse(message) as ClientMessage;

    switch (msg.type) {
      case "subscribe":
        this.sendGamesList(sender);
        break;
      case "create_game":
        this.handleCreateGame(sender, msg.hostName);
        break;
    }
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "POST") {
      const body = (await req.json()) as InternalMessage;

      switch (body.type) {
        case "update_game":
          this.games.set(body.game.roomId, {
            ...body.game,
            lastUpdate: Date.now(),
          });
          this.broadcastGamesList();
          break;
        case "remove_game":
          this.games.delete(body.roomId);
          this.broadcastGamesList();
          break;
      }

      return new Response("OK");
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private handleCreateGame(conn: Party.Connection, hostName: string) {
    const roomId = this.generateRoomId();

    const game: GameInfo = {
      hostName,
      playerCount: 0,
      maxPlayers: 4,
      isStarted: false,
      roomId,
      lastUpdate: Date.now(),
    };

    this.games.set(roomId, game);
    this.send(conn, { type: "game_created", roomId });
    this.broadcastGamesList();
  }

  private generateRoomId(): string {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    return Array.from({ length: 8 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  }

  private cleanupStaleGames() {
    const now = Date.now();
    let changed = false;

    this.games.forEach((game, roomId) => {
      if (now - game.lastUpdate > STALE_GAME_MS) {
        this.games.delete(roomId);
        changed = true;
      }
    });

    if (changed) {
      this.broadcastGamesList();
    }
  }

  private getActiveGames(): GameInfo[] {
    return [...this.games.values()].filter(g => !g.isStarted);
  }

  private sendGamesList(conn: Party.Connection) {
    this.send(conn, { type: "games", games: this.getActiveGames() });
  }

  private broadcastGamesList() {
    this.broadcast({ type: "games", games: this.getActiveGames() });
  }

  private send(conn: Party.Connection, msg: ServerMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage) {
    this.room.broadcast(JSON.stringify(msg));
  }
}
