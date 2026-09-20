import { describe, expect, it } from "bun:test";
import { roomHarness } from "./room-test-harness";
import type { ConnLike } from "./game-server";
import type { GameClientMessage } from "./protocol";
import { createGame } from "../engine";
import { dominionGame } from "../dominion/definition";
import { dominionModule } from "../dominion/module";

const latestState = (h: ReturnType<typeof roomHarness>, socket: ConnLike) => {
  const state = h.statesOf(socket).at(-1);
  return state === undefined
    ? undefined
    : dominionModule.stateSchema.parse(state);
};

describe("seats on the game server", () => {
  it("lets a lone host start against a rules bot that plays its own turns", async () => {
    const h = roomHarness();
    const host = h.connect("host");
    h.send(host, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    h.send(host, { type: "start_game" });
    expect(h.lastOf(host)?.type).toBe("error");

    h.send(host, {
      type: "start_game",
      bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
    });
    const started = h.seen(host).find(m => m.type === "game_started");
    expect(started?.type).toBe("game_started");
    if (started?.type !== "game_started") return;
    const botId = dominionModule.stateSchema
      .parse(started.state)
      .playerOrder.find(id => id !== "alice");
    expect(botId).toBeDefined();
    if (!botId) return;

    const list = h
      .seen(host)
      .flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);
    expect(list?.find(p => p.playerId === botId)?.controller).toBe("heuristic");
    expect(list?.find(p => p.playerId === "alice")?.controller).toBe("human");

    // Whoever the deal made first: after the bot's turns, it is always Alice's move.
    await h.settle();
    let state = latestState(h, host);
    expect(state && dominionGame.whoMustAct(state)).toBe("alice");

    const endPhase: GameClientMessage = {
      type: "command",
      command: { type: "END_PHASE", playerId: "alice" },
    };
    h.send(host, endPhase);
    h.send(host, endPhase);
    await h.settle();
    state = latestState(h, host);
    expect(state?.activePlayerId).toBe("alice");
    expect(state?.turn).toBeGreaterThanOrEqual(3);
  });

  it("guards set_seat: own seat yes, another human's seat no, even for the host", () => {
    const h = roomHarness();
    const alice = h.connect("a");
    const bob = h.connect("b");
    h.send(alice, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    h.send(bob, {
      type: "join",
      name: "Bob",
      game: "dominion",
      clientId: "bob",
    });
    expect(h.seen(alice).some(m => m.type === "game_started")).toBe(true);

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
    const list = h
      .seen(alice)
      .flatMap(m => (m.type === "player_list" ? [m.players] : []))
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
    await h.server.botsDriving;
    const started = h.seen(host).find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    const botId = dominionModule.stateSchema
      .parse(started.state)
      .playerOrder.find(id => id !== "alice");
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
    const after = h
      .seen(host)
      .flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);
    expect(after?.find(p => p.playerId === botId)?.controller).toBe("llm");
    expect(JSON.stringify(h.seen(host))).not.toContain("secret plan");
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
    h.send(host, {
      type: "sync_events",
      events: [...createGame(["human", "ai"], undefined, 42).eventLog],
    });
    expect(h.server.botsDriving).toBeNull();
    const list = h
      .seen(host)
      .flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);
    expect(list?.some(p => p.controller === "heuristic")).toBe(true);
  });
});
