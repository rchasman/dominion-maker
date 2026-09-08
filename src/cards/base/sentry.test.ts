import { describe, it, expect } from "bun:test";
import { sentry } from "./sentry";
import type { GameState, CardName } from "../../types/game-state";
import type { EffectStep } from "../program";
import type { DecisionChoice } from "../../types/pending-choice";
import { applyEvents } from "../../events/apply";

function createTestState(): GameState {
  return {
    playerOrder: ["human", "ai"],
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
      ai: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {} as Record<CardName, number>,
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

function context(state: GameState, playerId = "human") {
  return {
    state,
    playerId,
    card: "Sentry" as const,
    trigger: { type: "play" as const },
    random: () => 0.5,
  };
}
function begin(state: GameState) {
  return sentry.run(context(state), { type: "start" });
}
function answer(state: GameState, step: EffectStep, choice: DecisionChoice) {
  if (step.type !== "choice") throw new Error("Expected a choice");
  return sentry.run(context(state), {
    type: "answer",
    memory: JSON.parse(JSON.stringify(step.memory)),
    answer: choice,
  });
}

describe("Sentry", () => {
  it("draws before looking at the next two cards", () => {
    const state = createTestState();
    state.players.human!.deck = ["Gold", "Silver", "Estate", "Copper"];
    const step = begin(state);
    const after = applyEvents(state, step.events);
    expect(after.players.human!.hand).toEqual(["Copper"]);
    expect(after.players.human!.deck).toEqual(["Gold"]);
    expect(after.players.human!.setAside).toEqual(["Estate", "Silver"]);
    expect(step.type === "choice" && step.request.cardOptions).toEqual([
      "Estate",
      "Silver",
    ]);
    expect(after.actions).toBe(2);
  });
  it("trashes and discards using serialized memory without touching hand duplicates", () => {
    let state = createTestState();
    state.players.human!.hand = ["Estate", "Silver"];
    state.players.human!.deck = ["Silver", "Estate", "Copper"];
    let step = begin(state);
    state = JSON.parse(JSON.stringify(applyEvents(state, step.events)));
    expect(state.pendingChoice).toBeNull();
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "trash_card", 1: "discard_card" },
    });
    state = applyEvents(state, step.events);
    expect(state.players.human!.hand).toEqual(["Estate", "Silver", "Copper"]);
    expect(state.players.human!.discard).toEqual(["Silver"]);
    expect(state.trash).toEqual(["Estate"]);
    expect(state.players.human!.setAside).toEqual([]);
    expect(state.players.human!.deck).toEqual([]);
  });
  it("topdecks in requested order without taking cards from hand", () => {
    let state = createTestState();
    state.players.human!.hand = ["Estate"];
    state.players.human!.deck = ["Gold", "Silver", "Estate", "Copper"];
    let step = begin(state);
    state = applyEvents(state, step.events);
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "topdeck_card", 1: "topdeck_card" },
      cardOrder: [1, 0],
    });
    state = applyEvents(state, step.events);
    expect(state.players.human!.hand).toEqual(["Estate", "Copper"]);
    expect(state.players.human!.deck).toEqual(["Gold", "Estate", "Silver"]);
    expect(state.players.human!.setAside).toEqual([]);
  });
  it("preserves duplicate looked-at cards independently", () => {
    let state = createTestState();
    state.players.human!.deck = ["Estate", "Estate", "Copper"];
    let step = begin(state);
    state = applyEvents(state, step.events);
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "trash_card", 1: "topdeck_card" },
      cardOrder: [1],
    });
    state = applyEvents(state, step.events);
    expect(state.players.human!.deck).toEqual(["Estate"]);
    expect(state.trash).toEqual(["Estate"]);
    expect(state.players.human!.setAside).toEqual([]);
  });
  it("looks across a shuffle and records the order used by replay", () => {
    let state = createTestState();
    state.players.human!.deck = ["Estate", "Copper"];
    state.players.human!.discard = ["Gold", "Silver"];
    const before = state;
    let step = begin(state);
    state = applyEvents(state, step.events);
    expect(step.type === "choice" && step.request.cardOptions[0]).toBe(
      "Estate",
    );
    expect(state.players.human!.setAside?.length).toBe(2);
    expect(state.players.human!.deck.length).toBe(1);
    expect(state.players.human!.discard).toEqual([]);
    expect(
      applyEvents(before, JSON.parse(JSON.stringify(step.events))),
    ).toEqual(state);
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "topdeck_card", 1: "topdeck_card" },
      cardOrder: [0, 1],
    });
    state = applyEvents(state, step.events);
    expect(
      [...state.players.human!.hand, ...state.players.human!.deck].sort(),
    ).toEqual(["Copper", "Estate", "Gold", "Silver"]);
    expect(state.players.human!.setAside).toEqual([]);
  });
  it("handles zero or one available card after drawing and missing players", () => {
    const state = createTestState();
    expect(begin(state).type).toBe("done");
    state.players.human!.deck = ["Copper"];
    const step = begin(state);
    expect(step.type).toBe("done");
    expect(applyEvents(state, step.events).players.human!.hand).toEqual([
      "Copper",
    ]);
    state.players.human!.deck = ["Silver", "Copper"];
    const one = begin(state);
    expect(one.type === "choice" && one.request.cardOptions).toEqual([
      "Silver",
    ]);
    expect(
      sentry.run(context(state, "missing"), { type: "start" }).events,
    ).toEqual([]);
  });
  it("rejects impossible or unknown continuation cards", () => {
    expect(() => sentry.parseMemory({ revealed: [] })).toThrow();
    expect(() => sentry.parseMemory({ revealed: ["Imaginary"] })).toThrow();
  });
});
