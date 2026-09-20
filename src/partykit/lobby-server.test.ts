import { describe, it, expect } from "bun:test";
import LobbyServer, {
  type LobbyConnLike,
  type LobbyRoomLike,
} from "./lobby-server";
import type {
  GameUpdateMessage,
  LobbyClientMessage,
  LobbyServerMessage,
} from "./protocol";

function lobbyHarness() {
  const sockets = new Map<string, LobbyConnLike>();
  const messages = new Map<string, LobbyServerMessage[]>();
  const room: LobbyRoomLike = {
    id: "lobby",
    broadcast: message => {
      Array.from(sockets.values()).map(socket => socket.send(message));
    },
    getConnection: id => sockets.get(id),
  };
  const server = new LobbyServer(room);
  const connect = (id: string): LobbyConnLike => {
    messages.set(id, []);
    const socket: LobbyConnLike = {
      id,
      send: message => {
        if (typeof message === "string")
          messages.get(id)?.push(JSON.parse(message));
      },
    };
    sockets.set(id, socket);
    return socket;
  };
  const send = (socket: LobbyConnLike, message: LobbyClientMessage) =>
    server.handleMessage(JSON.stringify(message), socket);
  const seen = (socket: LobbyConnLike) => messages.get(socket.id) ?? [];
  const matched = (socket: LobbyConnLike) =>
    seen(socket).find(m => m.type === "game_matched");
  const join = (id: string, name: string): LobbyConnLike => {
    const socket = connect(id);
    send(socket, { type: "join_lobby", name, clientId: `client-${id}` });
    return socket;
  };
  const activeGames = (socket: LobbyConnLike) =>
    seen(socket)
      .flatMap(m => (m.type === "active_games" ? [m.games] : []))
      .at(-1);
  return { server, join, send, seen, matched, activeGames };
}

const update = (over: Partial<GameUpdateMessage> = {}): GameUpdateMessage => ({
  type: "game_update",
  roomId: "room-1",
  game: "dominion",
  players: [{ name: "Alice" }, { name: "Bob" }],
  spectatorCount: 0,
  isActive: true,
  isSinglePlayer: false,
  ...over,
});

describe("matchmaking carries the game", () => {
  it("tells both players which game they were matched into", () => {
    const h = lobbyHarness();
    const alice = h.join("a", "Alice");
    const bob = h.join("b", "Bob");

    h.send(alice, { type: "request_game", targetId: "b", game: "dominion" });
    const pending = h
      .seen(bob)
      .flatMap(m => (m.type === "requests" ? m.requests : []))
      .at(-1);
    if (!pending) throw new Error("Missing request");

    h.send(bob, { type: "accept_request", requestId: pending.id });
    const forAlice = h.matched(alice);
    const forBob = h.matched(bob);
    if (forAlice?.type !== "game_matched" || forBob?.type !== "game_matched")
      throw new Error("Missing match");
    expect(forAlice.game).toBe("dominion");
    expect(forBob.game).toBe("dominion");
    expect(forAlice.roomId).toBe(forBob.roomId);
    expect(forAlice.opponentName).toBe("Bob");
    expect(forBob.opponentName).toBe("Alice");
  });

  it("matches a mutual request on the game the waiting request named", () => {
    const h = lobbyHarness();
    const alice = h.join("a", "Alice");
    const bob = h.join("b", "Bob");

    h.send(bob, { type: "request_game", targetId: "a", game: "dominion" });
    h.send(alice, { type: "request_game", targetId: "b", game: "dominion" });

    expect(h.matched(alice)?.type).toBe("game_matched");
    const forBob = h.matched(bob);
    if (forBob?.type !== "game_matched") throw new Error("Missing match");
    expect(forBob.game).toBe("dominion");
  });

  it("refuses a request a player sends to themselves", () => {
    const h = lobbyHarness();
    const alice = h.join("a", "Alice");
    h.send(alice, { type: "request_game", targetId: "a", game: "dominion" });
    expect(h.seen(alice).at(-1)).toMatchObject({
      type: "error",
      message: "Cannot request game with yourself",
    });
  });

  it("lets the sender cancel a request and nobody else", () => {
    const h = lobbyHarness();
    const alice = h.join("a", "Alice");
    const bob = h.join("b", "Bob");
    h.send(alice, { type: "request_game", targetId: "b", game: "dominion" });
    const pending = h
      .seen(bob)
      .flatMap(m => (m.type === "requests" ? m.requests : []))
      .at(-1);
    if (!pending) throw new Error("Missing request");

    h.send(bob, { type: "cancel_request", requestId: pending.id });
    h.send(alice, { type: "cancel_request", requestId: pending.id });
    const left = h
      .seen(alice)
      .flatMap(m => (m.type === "requests" ? [m.requests] : []))
      .at(-1);
    expect(left).toEqual([]);
  });
});

describe("active games", () => {
  it("lists a running game with the game it plays", () => {
    const h = lobbyHarness();
    expect(
      h.server.handleRequest("POST", JSON.stringify(update())).status,
    ).toBe(200);
    const watcher = h.join("w", "Watcher");
    expect(h.activeGames(watcher)).toEqual([
      {
        roomId: "room-1",
        game: "dominion",
        players: [{ name: "Alice" }, { name: "Bob" }],
        spectatorCount: 0,
        isSinglePlayer: false,
      },
    ]);
  });

  it("drops a game that reports itself finished", () => {
    const h = lobbyHarness();
    h.server.handleRequest("POST", JSON.stringify(update()));
    h.server.handleRequest("POST", JSON.stringify(update({ isActive: false })));
    const watcher = h.join("w", "Watcher");
    expect(h.activeGames(watcher)).toEqual([]);
  });

  it("refuses an update that names no game", () => {
    const h = lobbyHarness();
    const { game: _game, ...noGame } = update();
    const response = h.server.handleRequest("POST", JSON.stringify(noGame));
    expect(response.status).toBe(400);
  });

  it("refuses anything but a POST", () => {
    const h = lobbyHarness();
    expect(h.server.handleRequest("GET", "").status).toBe(405);
  });
});
