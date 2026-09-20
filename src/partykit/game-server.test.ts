import { describe, it, expect } from "bun:test";
import GameServer, { type ConnLike, type RoomLike } from "./game-server";
import type { GameServerMessage, GameClientMessage } from "./protocol";
import { dominionModule } from "../dominion/module";
import { createGame } from "../engine";
import { GAMES } from "../games";

function roomHarness() {
  const sockets = new Map<string, ConnLike>();
  const messages = new Map<string, GameServerMessage[]>();
  const room: RoomLike = {
    id: "test",
    env: {},
    getConnections: () => sockets.values(),
    broadcast: message => {
      Array.from(sockets.values()).map(socket => socket.send(message));
    },
    context: {
      parties: {
        lobby: {
          get: () => ({ fetch: () => Promise.resolve(new Response("OK")) }),
        },
      },
    },
  };
  const server = new GameServer(room);
  const connect = (id: string): ConnLike => {
    messages.set(id, []);
    const socket: ConnLike = {
      id,
      send: message => {
        if (typeof message === "string") {
          messages.get(id)?.push(JSON.parse(message));
        }
      },
      close: () => {
        sockets.delete(id);
      },
    };
    sockets.set(id, socket);
    server.connect(socket);
    return socket;
  };
  const send = (socket: ConnLike, message: GameClientMessage) =>
    server.handleMessage(JSON.stringify(message), socket);
  const raw = (socket: ConnLike, message: string) =>
    server.handleMessage(message, socket);
  const seen = (socket: ConnLike) => messages.get(socket.id) ?? [];
  const lastOf = (socket: ConnLike) => seen(socket).at(-1);
  const eventTypes = (socket: ConnLike) =>
    seen(socket).flatMap(m =>
      "events" in m
        ? m.events.map(event => dominionModule.eventSchema.parse(event).type)
        : [],
    );
  return { server, connect, send, raw, seen, lastOf, eventTypes };
}

const startAgainstBot = (h: ReturnType<typeof roomHarness>) => {
  const host = h.connect("host");
  h.send(host, {
    type: "join",
    name: "Alice",
    game: "dominion",
    clientId: "alice",
  });
  h.send(host, {
    type: "start_game",
    bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
  });
  return host;
};

describe("a room plays one registered game", () => {
  it("refuses a join that does not name the room's game", () => {
    const h = roomHarness();
    const stranger = h.connect("stranger");
    h.raw(stranger, JSON.stringify({ type: "join", name: "Zed", game: "go" }));
    expect(h.lastOf(stranger)).toMatchObject({
      type: "error",
      message: "Invalid message",
    });

    const host = h.connect("host");
    h.send(host, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    // Every other registered game must bounce off this Dominion room.
    Object.keys(GAMES)
      .filter(id => id !== "dominion")
      .map(id => {
        const other = h.connect(`other-${id}`);
        h.raw(
          other,
          JSON.stringify({ type: "join", name: "Zed", game: id, clientId: id }),
        );
        expect(h.lastOf(other)).toMatchObject({
          type: "error",
          message: "This room is playing Dominion",
        });
      });
  });

  it("names the room's game on every state it ships", () => {
    const h = roomHarness();
    const host = startAgainstBot(h);
    const started = h.seen(host).find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    expect(started.game).toBe("dominion");
    expect(Object.values(started.playerInfo).map(info => info.type)).toEqual([
      "human",
      "ai",
    ]);
  });
});

describe("the room module validates what crosses the wire", () => {
  it("refuses start_game options its module rejects", () => {
    const h = roomHarness();
    const host = h.connect("host");
    h.send(host, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    h.send(host, {
      type: "start_game",
      options: { seed: "not a number" },
      bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
    });
    expect(h.lastOf(host)?.type).toBe("error");
    expect(h.seen(host).some(m => m.type === "game_started")).toBe(false);
  });

  it("accepts start_game options its module allows", () => {
    const h = roomHarness();
    const host = h.connect("host");
    h.send(host, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    h.send(host, {
      type: "start_game",
      options: { seed: 42 },
      bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
    });
    expect(h.seen(host).some(m => m.type === "game_started")).toBe(true);
  });

  it("refuses a sync_events batch holding an event its module rejects", () => {
    const h = roomHarness();
    const host = h.connect("host");
    h.send(host, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    h.send(host, {
      type: "start_singleplayer",
      seats: { human: { kind: "human" }, ai: { kind: "heuristic" } },
    });
    const log = [...createGame(["human", "ai"], undefined, 42).eventLog];
    h.send(host, { type: "sync_events", events: log });
    expect(h.lastOf(host)?.type).toBe("full_state");

    h.send(host, {
      type: "sync_events",
      events: [...log, { type: "NOT_AN_EVENT" }],
    });
    expect(h.lastOf(host)).toMatchObject({
      type: "error",
      message: "Failed to sync events",
    });
  });

  it("refuses a command its module rejects", () => {
    const h = roomHarness();
    const host = startAgainstBot(h);
    h.send(host, { type: "command", command: { type: "FLY_AWAY" } });
    expect(h.lastOf(host)).toMatchObject({
      type: "error",
      message: "Invalid command",
    });
  });
});

describe("the room module acts after an accepted command", () => {
  it("lets the module's afterCommand approve an undo for the bot seat", async () => {
    const h = roomHarness();
    const host = startAgainstBot(h);
    await h.server.botsDriving;
    const started = h.seen(host).find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    const turnStarted = started.events
      .map(event => dominionModule.eventSchema.parse(event))
      .find(event => event.type === "TURN_STARTED");
    if (!turnStarted?.id) throw new Error("Missing turn");

    h.send(host, {
      type: "command",
      command: {
        type: "REQUEST_UNDO",
        playerId: "alice",
        toEventId: turnStarted.id,
      },
    });

    expect(h.eventTypes(host)).toContain("UNDO_APPROVED");
    expect(h.eventTypes(host)).toContain("UNDO_EXECUTED");
  });
});
