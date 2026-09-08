import { describe, it, expect } from "bun:test";
import { bandit } from "./bandit";
import type { GameState } from "../../types/game-state";
import { applyEvents } from "../../events/apply";

function createTestState(): GameState {
  return {
    playerOrder: ["human", "ai1", "ai2"],
    activePlayerId: "human",
    phase: "action",
    turn: 1,
    actions: 1,
    buys: 1,
    coins: 0,
    players: {
      human: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai1: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai2: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {} as GameState["supply"],
    trash: [],
    log: [],
    turnHistory: [],
    kingdomCards: [],
    pendingChoice: null,
    pendingChoiceEventId: null,
    gameOver: false,
    winnerId: null,
    activeEffects: [],
  };
}

function context(state: GameState, target = "ai1") {
  return {
    state,
    playerId: "human",
    card: "Bandit" as const,
    trigger: { type: "attack" as const, target },
    random: () => 0.5,
  };
}
function attack(state: GameState, target = "ai1") {
  return bandit.run(context(state, target), { type: "start" });
}
describe("Bandit", () => {
  it("gains Gold and schedules opponents without executing them", () => {
    const state = createTestState();
    state.supply.Gold = 1;
    state.players.ai1!.deck = ["Silver"];
    const result = bandit.run(
      { ...context(state), trigger: { type: "play" } },
      { type: "start" },
    );
    expect(result).toEqual({
      type: "schedule",
      events: [
        { type: "CARD_GAINED", playerId: "human", card: "Gold", to: "discard" },
      ],
      operations: [{ type: "attack", targets: ["ai1", "ai2"] }],
    });
    state.supply.Gold = 0;
    expect(
      bandit.run(
        { ...context(state), trigger: { type: "play" } },
        { type: "start" },
      ).events,
    ).toEqual([]);
  });
  it("reveals and discards both cards when no eligible Treasure exists", () => {
    const state = createTestState();
    state.players.ai1!.deck = ["Estate", "Copper"];
    const result = attack(state);
    expect(result.type).toBe("done");
    expect(
      result.events.filter(e => e.type === "CARD_REVEALED").map(e => e.card),
    ).toEqual(["Copper", "Estate"]);
    const after = applyEvents(state, result.events);
    expect(after.players.ai1!.discard).toEqual(["Copper", "Estate"]);
    expect(after.players.ai1!.setAside).toEqual([]);
    expect(after.trash).toEqual([]);
  });
  it("automatically trashes a lone eligible Treasure", () => {
    const state = createTestState();
    state.players.ai1!.deck = ["Silver", "Estate"];
    const after = applyEvents(state, attack(state).events);
    expect(after.trash).toEqual(["Silver"]);
    expect(after.players.ai1!.discard).toEqual(["Estate"]);
  });
  it("offers distinct Treasures and resolves from serialized private memory", () => {
    let state = createTestState();
    state.players.ai1!.deck = ["Silver", "Gold"];
    state.players.ai2!.deck = ["Silver", "Estate"];
    const initial = attack(state);
    if (initial.type !== "choice") throw new Error("Expected choice");
    expect(initial.request).toMatchObject({
      playerId: "ai1",
      cardOptions: ["Gold", "Silver"],
      min: 1,
      max: 1,
    });
    state = applyEvents(state, initial.events);
    const result = bandit.run(context(state), {
      type: "answer",
      memory: JSON.parse(JSON.stringify(initial.memory)),
      answer: { selectedCards: ["Silver"] },
    });
    expect(result.type).toBe("done");
    const after = applyEvents(state, result.events);
    expect(after.trash).toEqual(["Silver"]);
    expect(after.players.ai1!.discard).toEqual(["Gold"]);
    expect(after.players.ai1!.setAside).toEqual([]);
    // The runner, not this continuation, owns advancing to ai2.
    expect(after.players.ai2!.deck).toEqual(["Silver", "Estate"]);
    const next = applyEvents(after, attack(after, "ai2").events);
    expect(next.trash).toEqual(["Silver", "Silver"]);
    expect(next.players.ai2!.discard).toEqual(["Estate"]);
  });
  it("trashes only one of duplicate Treasures without prompting", () => {
    const state = createTestState();
    state.players.ai1!.deck = ["Silver", "Silver"];
    const result = attack(state);
    expect(result.type).toBe("done");
    const after = applyEvents(state, result.events);
    expect(after.trash).toEqual(["Silver"]);
    expect(after.players.ai1!.discard).toEqual(["Silver"]);
  });
  it("handles empty decks, missing targets, and one available card", () => {
    const state = createTestState();
    expect(attack(state).events).toEqual([]);
    expect(attack(state, "missing").events).toEqual([]);
    state.players.ai1!.deck = ["Silver"];
    const result = attack(state);
    expect(result.events.filter(e => e.type === "CARD_REVEALED")).toHaveLength(
      1,
    );
    expect(applyEvents(state, result.events).trash).toEqual(["Silver"]);
  });
  it("never trashes Copper", () => {
    const state = createTestState();
    state.players.ai1!.deck = ["Copper", "Copper"];
    const after = applyEvents(state, attack(state).events);
    expect(after.trash).toEqual([]);
    expect(after.players.ai1!.discard).toEqual(["Copper", "Copper"]);
  });
  it("preserves cards when revealing across a shuffle", () => {
    const state = createTestState();
    state.players.ai1!.deck = ["Estate"];
    state.players.ai1!.discard = ["Silver"];
    const result = attack(state);
    const after = applyEvents(state, result.events);
    expect(after.trash).toEqual(["Silver"]);
    expect(after.players.ai1!.discard).toEqual(["Estate"]);
    expect(after.players.ai1!.deck).toEqual([]);
    expect(after.players.ai1!.setAside).toEqual([]);
    expect(
      applyEvents(state, JSON.parse(JSON.stringify(result.events))),
    ).toEqual(after);
  });
  it("rejects impossible continuation memory", () => {
    expect(() => bandit.parseMemory({ revealed: ["Gold"] })).toThrow();
    expect(() =>
      bandit.parseMemory({ revealed: ["Gold", "Imaginary"] }),
    ).toThrow();
  });
});
