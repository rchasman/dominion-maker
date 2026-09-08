import { describe, it, expect } from "bun:test";
import { library } from "./library";
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
    card: "Library" as const,
    trigger: { type: "play" as const },
    random: () => 0.5,
  };
}
function begin(state: GameState) {
  return library.run(context(state), { type: "start" });
}
function answer(state: GameState, step: EffectStep, choice: DecisionChoice) {
  if (step.type !== "choice") throw new Error("Expected a choice");
  return library.run(context(state), {
    type: "answer",
    memory: JSON.parse(JSON.stringify(step.memory)),
    answer: choice,
  });
}

describe("Library", () => {
  it("does nothing with seven cards or a missing player", () => {
    const state = createTestState();
    state.players.human!.hand = Array(7).fill("Copper");
    expect(begin(state)).toEqual({ type: "done", events: [] });
    expect(library.run(context(state, "missing"), { type: "start" })).toEqual({
      type: "done",
      events: [],
    });
  });
  it("draws ordinary cards until seven, leaving excess cards in the deck", () => {
    const state = createTestState();
    state.players.human!.hand = Array(5).fill("Copper");
    state.players.human!.deck = ["Gold", "Silver", "Estate"];
    const step = begin(state);
    const after = applyEvents(state, step.events);
    expect(after.players.human!.hand).toEqual([
      ...Array(5).fill("Copper"),
      "Estate",
      "Silver",
    ]);
    expect(after.players.human!.deck).toEqual(["Gold"]);
    expect(step.type).toBe("done");
  });
  it("resumes serialized private memory with no pending UI choice", () => {
    let state = createTestState();
    state.players.human!.hand = Array(4).fill("Copper");
    state.players.human!.deck = [
      "Gold",
      "Smithy",
      "Silver",
      "Village",
      "Estate",
    ];
    let step = begin(state);
    state = applyEvents(state, step.events);
    expect(state.players.human!.hand.length).toBe(5);
    expect(step.type === "choice" && step.request.cardOptions).toEqual([
      "Village",
    ]);
    expect(state.players.human!.setAside).toEqual(["Village"]);
    state = JSON.parse(JSON.stringify(state));
    expect(state.pendingChoice).toBeNull();
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "discard_card" },
    });
    state = applyEvents(state, step.events);
    expect(state.players.human!.hand.length).toBe(6);
    expect(step.type === "choice" && step.request.cardOptions).toEqual([
      "Smithy",
    ]);
    expect(state.players.human!.discard).toEqual([]);
    expect(state.players.human!.setAside).toEqual(["Village", "Smithy"]);
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "draw_card" },
    });
    state = applyEvents(state, step.events);
    expect(state.players.human!.hand.at(-1)).toBe("Smithy");
    expect(state.players.human!.hand.length).toBe(7);
    expect(state.players.human!.deck).toEqual(["Gold"]);
    expect(state.players.human!.discard).toEqual(["Village"]);
    expect(state.players.human!.setAside).toEqual([]);
    expect(step.type).toBe("done");
  });
  it("does not reshuffle skipped Actions and exhausts available cards", () => {
    let state = createTestState();
    state.players.human!.deck = ["Village"];
    state.players.human!.discard = ["Silver", "Copper"];
    let step = begin(state);
    state = applyEvents(state, step.events);
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "discard_card" },
    });
    const after = applyEvents(state, step.events);
    expect(after.players.human!.hand.slice().sort()).toEqual([
      "Copper",
      "Silver",
    ]);
    expect(after.players.human!.discard).toEqual(["Village"]);
    expect(after.players.human!.deck).toEqual([]);
    expect(after.players.human!.setAside).toEqual([]);
    expect(step.type).toBe("done");
    expect(applyEvents(state, JSON.parse(JSON.stringify(step.events)))).toEqual(
      after,
    );
  });
  it("keeps duplicate Actions as separate choices and conserves every card", () => {
    let state = createTestState();
    state.players.human!.deck = ["Village", "Village"];
    let step = begin(state);
    state = applyEvents(state, step.events);
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "discard_card" },
    });
    state = applyEvents(state, step.events);
    step = answer(state, step, {
      selectedCards: [],
      cardActions: { 0: "draw_card" },
    });
    state = applyEvents(state, step.events);
    expect(state.players.human!.hand).toEqual(["Village"]);
    expect(state.players.human!.discard).toEqual(["Village"]);
    expect(state.players.human!.setAside).toEqual([]);
    expect(step.type).toBe("done");
  });
  it("rejects malformed private continuation memory", () => {
    expect(() =>
      library.parseMemory({
        offered: "Village",
        skipped: [],
        unexpected: true,
      }),
    ).toThrow();
    expect(() =>
      library.parseMemory({ offered: "Imaginary", skipped: [] }),
    ).toThrow();
  });
});
