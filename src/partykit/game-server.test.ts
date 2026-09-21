import { describe, it, expect } from "bun:test";
import { roomHarness, type RoomHarness } from "./room-harness.test-fixture";
import type { ConnLike } from "./game-server";
import { dominionModule } from "../dominion/module";
import { countingModule } from "./counting-module.test-fixture";
import { GAMES } from "../games";

const joinAs = (h: RoomHarness, socket: ConnLike, clientId: string) =>
  h.send(socket, {
    type: "join",
    name: clientId,
    game: "dominion",
    clientId,
  });

const startAgainstBot = (h: RoomHarness, options?: unknown) => {
  const host = h.connect("host");
  joinAs(h, host, "alice");
  h.send(h.connect("ignored"), { type: "leave" });
  h.send(host, {
    type: "start_game",
    ...(options === undefined ? {} : { options }),
    bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
  });
  return host;
};

const stateOf = (value: unknown) => dominionModule.stateSchema.parse(value);

describe("a room plays one registered game", () => {
  it("refuses a join that does not name the room's game", () => {
    const h = roomHarness();
    const stranger = h.connect("stranger");
    h.raw(
      stranger,
      JSON.stringify({ type: "join", name: "Zed", game: "checkers" }),
    );
    expect(h.lastOf(stranger)).toMatchObject({
      type: "error",
      message: "Invalid message",
    });

    const host = h.connect("host");
    joinAs(h, host, "alice");
    // Every other registered game must bounce off this Dominion room, so a
    // third game is covered the day it joins the registry.
    const others = Object.keys(GAMES).filter(id => id !== "dominion");
    expect(others.length).toBeGreaterThan(0);
    others.map(id => {
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

  it("does not let a refused join fix the room's game", () => {
    const h = roomHarness();
    const refused = h.connect("refused");
    // No clientId: this connection never gets a seat
    h.send(refused, { type: "join", name: "Zed", game: "dominion" });
    expect(h.lastOf(refused)).toMatchObject({
      type: "error",
      message: "clientId required",
    });

    const host = h.connect("host");
    joinAs(h, host, "alice");
    expect(h.lastOf(host)?.type).not.toBe("error");
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

describe("a room runs whatever module it was given", () => {
  // The registry is injected, so this room answers "dominion" with a counting
  // game: proof that nothing below `useGame` knows which game it is running.
  const countingRoom = () => {
    const h = roomHarness(() => countingModule);
    const first = h.connect("first");
    const second = h.connect("second");
    joinAs(h, first, "a");
    joinAs(h, second, "b");
    return { h, first, second };
  };

  it("starts a counting game and plays it through commands", () => {
    const { h, first } = countingRoom();
    const started = h.seen(first).find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    expect(started.state).toEqual({
      seats: ["a", "b"],
      total: 0,
      turn: "a",
      over: false,
    });

    h.send(first, {
      type: "command",
      command: { type: "ADD", by: "a", add: 2 },
    });
    expect(h.statesOf(first).at(-1)).toEqual({
      seats: ["a", "b"],
      total: 2,
      turn: "b",
      over: false,
    });
  });

  it("refuses a counting command the counting module rejects", () => {
    const { h, first } = countingRoom();
    h.send(first, {
      type: "command",
      command: { type: "ADD", by: "a", add: 9 },
    });
    expect(h.lastOf(first)).toMatchObject({
      type: "error",
      message: "Invalid command",
    });
  });

  it("refuses options the counting module does not take", () => {
    const h = roomHarness(() => countingModule);
    const host = h.connect("host");
    joinAs(h, host, "a");
    h.send(host, {
      type: "start_game",
      options: { seed: 1 },
      bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
    });
    expect(h.lastOf(host)).toMatchObject({
      type: "error",
      message: "The counting game takes no options",
    });
  });
});

describe("the room module validates what crosses the wire", () => {
  it("refuses start_game options its module rejects, and starts on a retry", () => {
    const h = roomHarness();
    const host = h.connect("host");
    joinAs(h, host, "alice");
    const bots: Array<{ name: string; controller: { kind: "heuristic" } }> = [
      { name: "Bot", controller: { kind: "heuristic" } },
    ];

    h.send(host, {
      type: "start_game",
      options: { seed: "not a number" },
      bots,
    });
    expect(h.lastOf(host)?.type).toBe("error");
    expect(h.countOf(host, "game_started")).toBe(0);

    // A refusal must leave the room startable: same host, same bot list
    h.send(host, { type: "start_game", options: { seed: 42 }, bots });
    expect(h.countOf(host, "game_started")).toBe(1);
  });

  it("refuses a sync_events log that does not hold two players", () => {
    const h = roomHarness(() => countingModule);
    const host = h.connect("host");
    joinAs(h, host, "a");
    h.send(host, {
      type: "start_singleplayer",
      seats: { a: { kind: "human" }, b: { kind: "heuristic" } },
    });

    h.send(host, {
      type: "sync_events",
      events: [{ type: "STARTED", seats: ["a"], id: "count-0" }],
    });
    expect(h.lastOf(host)).toMatchObject({
      type: "error",
      message: "Failed to sync events",
    });

    h.send(host, {
      type: "sync_events",
      events: [{ type: "STARTED", seats: ["a", "b"], id: "count-0" }],
    });
    expect(h.lastOf(host)?.type).toBe("full_state");
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

describe("history preview", () => {
  it("replays a prefix of the log, not the whole log", async () => {
    const h = roomHarness();
    const host = startAgainstBot(h);
    await h.settle();
    h.send(host, {
      type: "command",
      command: { type: "END_PHASE", playerId: "alice" },
    });
    h.send(host, {
      type: "command",
      command: { type: "END_PHASE", playerId: "alice" },
    });
    await h.settle();

    const started = h.seen(host).find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    const firstTurn = started.events
      .map(event => dominionModule.eventSchema.parse(event))
      .find(event => event.type === "TURN_STARTED");
    if (!firstTurn?.id) throw new Error("Missing turn");
    expect(stateOf(h.statesOf(host).at(-1)).turn).toBeGreaterThanOrEqual(3);

    h.send(host, { type: "preview_state", eventId: firstTurn.id });
    const preview = h.lastOf(host);
    if (preview?.type !== "preview_state") throw new Error("Missing preview");
    expect(stateOf(preview.state).turn).toBe(1);
  });

  it("answers a preview it cannot replay with an error", () => {
    const h = roomHarness(() => ({
      ...countingModule,
      loadEngine: () => {
        throw new Error("cannot load");
      },
    }));
    const first = h.connect("first");
    const second = h.connect("second");
    joinAs(h, first, "a");
    joinAs(h, second, "b");
    h.send(first, { type: "preview_state", eventId: "count-0" });
    expect(h.lastOf(first)).toMatchObject({
      type: "error",
      message: "Failed to load history",
    });
  });

  it("answers a preview of an event it does not hold with no state", () => {
    const h = roomHarness();
    const host = startAgainstBot(h);
    h.send(host, { type: "preview_state", eventId: "evt-nowhere" });
    const preview = h.lastOf(host);
    if (preview?.type !== "preview_state") throw new Error("Missing preview");
    expect(preview.state).toBeNull();
  });
});

describe("the room module acts after an accepted command", () => {
  it("lets the module's afterCommand approve an undo for the bot seat", async () => {
    const h = roomHarness();
    const host = startAgainstBot(h);
    await h.settle();
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

    const types = h
      .seen(host)
      .flatMap(m =>
        "events" in m
          ? m.events.map(event => dominionModule.eventSchema.parse(event).type)
          : [],
      );
    expect(types).toContain("UNDO_APPROVED");
    expect(types).toContain("UNDO_EXECUTED");
  });
});

describe("setup never crosses the room wire", () => {
  const playerListOf = (h: RoomHarness, socket: ConnLike) =>
    h
      .seen(socket)
      .flatMap(m => (m.type === "player_list" ? [m.players] : []))
      .at(-1);

  it("refuses a START_GAME command and leaves the live game standing", () => {
    const h = roomHarness();
    const host = h.connect("host");
    const guest = h.connect("guest");
    joinAs(h, host, "alice");
    joinAs(h, guest, "bob");
    h.send(host, { type: "start_game" });
    expect(h.countOf(host, "game_started")).toBe(1);

    const active = stateOf(h.statesOf(host).at(-1)).activePlayerId;
    const seat = active === "alice" ? host : guest;
    const before = {
      players: playerListOf(h, host),
      shipped: h.countOf(host, "game_started", "events", "full_state"),
      log: h.statesOf(host).length,
    };

    h.send(seat, {
      type: "command",
      command: { type: "START_GAME", players: ["mallory", active], seed: 7 },
    });

    expect(h.lastOf(seat)?.type).toBe("error");
    expect(h.countOf(host, "game_started", "events", "full_state")).toBe(
      before.shipped,
    );
    expect(h.statesOf(host).length).toBe(before.log);
    expect(playerListOf(h, host)).toEqual(before.players);
    expect(stateOf(h.statesOf(host).at(-1)).playerOrder).toEqual([
      "alice",
      "bob",
    ]);
  });
});
