import { describe, expect, it } from "bun:test";
import GameServer, { type ConnLike, type RoomLike } from "./game-server";
import { createGame } from "../engine";
import type { GameServerMessage, GameClientMessage } from "./protocol";
import { dominionGame } from "../dominion/definition";

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
  const lastOf = (socket: ConnLike) => messages.get(socket.id)?.at(-1);
  const latestState = (socket: ConnLike) =>
    messages
      .get(socket.id)
      ?.flatMap(m => ("state" in m && m.state ? [m.state] : []))
      .at(-1);
  return { server, connect, send, messages, lastOf, latestState };
}

describe("seats on the game server", () => {
  it("lets a lone host start against a rules bot that plays its own turns", async () => {
    const h = roomHarness();
    const host = h.connect("host");
    h.send(host, { type: "join", name: "Alice", clientId: "alice" });
    h.send(host, { type: "start_game" });
    expect(h.lastOf(host)?.type).toBe("error");

    h.send(host, {
      type: "start_game",
      bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
    });
    const started = h.messages
      .get(host.id)
      ?.find(m => m.type === "game_started");
    expect(started?.type).toBe("game_started");
    if (started?.type !== "game_started") return;
    const botId = started.state.playerOrder.find(id => id !== "alice");
    expect(botId).toBeDefined();
    if (!botId) return;

    const list = h.messages
      .get(host.id)
      ?.flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);
    expect(list?.find(p => p.playerId === botId)?.controller).toBe("heuristic");
    expect(list?.find(p => p.playerId === "alice")?.controller).toBe("human");

    // Whoever the deal made first: after the bot's turns, it is always Alice's move.
    const settle = async () => {
      await h.server.botsDriving;
      await new Promise(resolve => setTimeout(resolve, 0));
      await h.server.botsDriving;
    };
    await settle();
    let state = h.latestState(host);
    expect(state && dominionGame.whoMustAct(state)).toBe("alice");

    h.send(host, { type: "end_phase" });
    h.send(host, { type: "end_phase" });
    await settle();
    state = h.latestState(host);
    expect(state?.activePlayerId).toBe("alice");
    expect(state?.turn).toBeGreaterThanOrEqual(3);
  });

  it("guards set_seat: own seat yes, another human's seat no, even for the host", () => {
    const h = roomHarness();
    const alice = h.connect("a");
    const bob = h.connect("b");
    h.send(alice, { type: "join", name: "Alice", clientId: "alice" });
    h.send(bob, { type: "join", name: "Bob", clientId: "bob" });
    expect(h.messages.get(alice.id)?.some(m => m.type === "game_started")).toBe(
      true,
    );

    h.send(bob, {
      type: "set_seat",
      playerId: "alice",
      controller: { kind: "heuristic" },
    });
    expect(h.lastOf(bob)).toMatchObject({
      type: "error",
      message: "Not your seat",
    });

    h.send(bob, {
      type: "set_seat",
      playerId: "bob",
      controller: { kind: "heuristic" },
    });
    const list = h.messages
      .get(alice.id)
      ?.flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);
    expect(list?.find(p => p.playerId === "bob")?.controller).toBe("heuristic");

    h.send(alice, {
      type: "set_seat",
      playerId: "bob",
      controller: { kind: "human" },
    });
    expect(h.lastOf(alice)).toMatchObject({
      type: "error",
      message: "Not your seat",
    });
  });

  it("lets the host re-seat a bot and keeps the LLM roster off the wire", async () => {
    const h = roomHarness();
    const host = h.connect("host");
    h.send(host, { type: "join", name: "Alice", clientId: "alice" });
    h.send(host, {
      type: "start_game",
      bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
    });
    await h.server.botsDriving;
    const started = h.messages
      .get(host.id)
      ?.find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    const botId = started.state.playerOrder.find(id => id !== "alice");
    if (!botId) throw new Error("Missing bot");

    h.send(host, {
      type: "set_seat",
      playerId: botId,
      controller: {
        kind: "llm",
        models: ["gpt-5.4-nano"],
        consensusCount: 1,
        customStrategy: "secret plan",
      },
    });
    const after = h.messages
      .get(host.id)
      ?.flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);
    expect(after?.find(p => p.playerId === botId)?.controller).toBe("llm");
    expect(JSON.stringify(h.messages.get(host.id))).not.toContain(
      "secret plan",
    );
    // Stop the LLM seat before it tries to reach an API this test does not run
    h.send(host, {
      type: "set_seat",
      playerId: botId,
      controller: { kind: "heuristic" },
    });
    await h.server.botsDriving;
  });

  it("never drives a mirrored local game", () => {
    const h = roomHarness();
    const host = h.connect("host");
    h.send(host, { type: "join", name: "Alice", clientId: "alice" });
    h.send(host, {
      type: "start_singleplayer",
      seats: { human: { kind: "human" }, ai: { kind: "heuristic" } },
    });
    h.send(host, {
      type: "sync_events",
      events: [...createGame(["human", "ai"], undefined, 42).eventLog],
    });
    expect(h.server.botsDriving).toBeNull();
    const list = h.messages
      .get(host.id)
      ?.flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);
    expect(list?.some(p => p.controller === "heuristic")).toBe(true);
  });
});
