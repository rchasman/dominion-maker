import { describe, expect, it } from "bun:test";
import { roomHarness } from "./room-test-harness";
import { createGame } from "../engine";
import { playerView, publicEvents } from "../dominion/view";
import { gameStateSchema } from "../validation/game-state";
import { dominionModule } from "../dominion/module";

describe("multiplayer privacy and credentials", () => {
  it("projects private zones, choices, RNG and execution memory out of state and history", () => {
    const engine = createGame(["alice", "bob"], undefined, 42);
    const state = engine.state;
    state.players.bob!.hand = ["Witch", "Gold"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "bob",
      cardBeingPlayed: "Sentry",
      prompt: "Choose",
      cardOptions: ["Gold"],
      min: 1,
      max: 1,
    };
    const view = playerView(state, [...engine.eventLog], "alice");
    expect(view.players.bob!.hand).toEqual([]);
    expect(view.players.bob!.handCount).toBe(2);
    expect(view.players.alice!.hand).toEqual(state.players.alice!.hand);
    expect(view.players.alice!.deck).toEqual([]);
    expect(view.players.bob!.publicCards).toHaveLength(
      state.players.bob!.deck.length + 2,
    );
    expect(view.pendingChoice).toMatchObject({
      playerId: "bob",
      cardOptions: [],
      prompt: "Waiting for another player",
    });
    expect(view).not.toHaveProperty("randomState");
    expect(view).not.toHaveProperty("executionStack");
    expect(
      publicEvents([...engine.eventLog]).some(e =>
        [
          "INITIAL_HAND_DRAWN",
          "DECK_SHUFFLED",
          "RANDOM_STATE_UPDATED",
        ].includes(e.type),
      ),
    ).toBe(false);
    expect(gameStateSchema.safeParse(view).success).toBe(true);
  });

  it("sends personalized state and rejects impersonation and forged event sync", () => {
    const h = roomHarness();
    const alice = h.connect("socket-a");
    const bob = h.connect("socket-b");
    h.send(alice, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    const joined = h.seen(alice).find(m => m.type === "joined");
    if (joined?.type !== "joined") throw new Error("Missing join");
    expect(joined.reconnectToken).toBeTruthy();
    h.send(bob, {
      type: "join",
      name: "Bob",
      game: "dominion",
      clientId: "bob",
    });
    const started = h.seen(alice).find(m => m.type === "game_started");
    if (started?.type !== "game_started") throw new Error("Missing game");
    const startedState = dominionModule.stateSchema.parse(started.state);
    expect(startedState.players.bob!.hand).toEqual([]);
    expect(startedState.players.alice!.hand).toHaveLength(5);
    expect(JSON.stringify(h.seen(bob))).not.toContain(joined.reconnectToken!);
    const attacker = h.connect("attacker");
    h.send(attacker, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    expect(h.seen(attacker).at(-1)?.type).toBe("error");
    h.send(attacker, { type: "join", name: "Alice", game: "dominion" });
    expect(h.seen(attacker).at(-1)?.type).toBe("error");
    const beforeSync = h
      .seen(alice)
      .filter(m => m.type === "full_state").length;
    h.send(alice, {
      type: "sync_events",
      events: [...createGame(["alice", "bob"]).eventLog],
    });
    expect(h.seen(alice).at(-1)).toMatchObject({
      type: "error",
      message: "Only a local-game host can sync events",
    });
    expect(h.seen(alice).filter(m => m.type === "full_state").length).toBe(
      beforeSync,
    );
    const rejoin = h.connect("socket-a-new");
    h.send(rejoin, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
      reconnectToken: joined.reconnectToken!,
    });
    expect(h.seen(rejoin).some(m => m.type === "joined" && m.isHost)).toBe(
      true,
    );
    // Mid-log, so the preview really replays a prefix rather than the whole log
    const history = started.events.map(event =>
      dominionModule.eventSchema.parse(event),
    );
    const turnStartedId = history.find(
      event => event.type === "TURN_STARTED",
    )?.id;
    expect(turnStartedId).toBeDefined();
    expect(history.at(-1)?.id).not.toBe(turnStartedId);
    h.send(rejoin, { type: "preview_state", eventId: turnStartedId! });
    const preview = h.seen(rejoin).at(-1);
    expect(preview?.type).toBe("preview_state");
    if (preview?.type === "preview_state")
      expect(
        dominionModule.stateSchema.parse(preview.state).players.bob!.hand,
      ).toEqual([]);
    const spectator = h.connect("spectator");
    h.send(spectator, { type: "spectate", name: "Viewer", game: "dominion" });
    const spectatorState = h.seen(spectator).find(m => m.type === "full_state");
    if (spectatorState?.type !== "full_state")
      throw new Error("Missing spectator state");
    expect(
      Object.values(
        dominionModule.stateSchema.parse(spectatorState.state).players,
      ).every(p => p.hand.length === 0 && p.deck.length === 0),
    ).toBe(true);
  });

  it("rejects a local-game sync carrying a forged event", () => {
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
    expect(h.seen(host).at(-1)?.type).toBe("full_state");

    const accepted = h
      .seen(host)
      .filter(m => m.type === "full_state" || m.type === "game_started").length;
    h.send(host, {
      type: "sync_events",
      events: [...log, { type: "NOT_AN_EVENT", playerId: "human" }],
    });
    expect(h.seen(host).at(-1)).toMatchObject({
      type: "error",
      message: "Failed to sync events",
    });
    expect(
      h
        .seen(host)
        .filter(m => m.type === "full_state" || m.type === "game_started")
        .length,
    ).toBe(accepted);
  });

  it("returns an error for malformed messages without breaking the next join", () => {
    const h = roomHarness();
    const socket = h.connect("a");
    for (const malformed of [
      "{",
      "null",
      '{"type":"buy_card","card":"Bogus"}',
      '{"type":"chat","message":7}',
    ]) {
      expect(() => h.raw(socket, malformed)).not.toThrow();
      expect(h.seen(socket).at(-1)?.type).toBe("error");
    }
    h.send(socket, {
      type: "join",
      name: "Alice",
      game: "dominion",
      clientId: "alice",
    });
    expect(h.seen(socket).some(m => m.type === "joined")).toBe(true);
  });
});
