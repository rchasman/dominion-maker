import { describe, it, expect } from "bun:test";
import { library } from "./library";
import type { GameState, CardName } from "../../types/game-state";
import type { CardEffectResult } from "../effect-types";
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

function options(state: GameState): CardName[] {
  return state.pendingChoice?.choiceType === "decision"
    ? state.pendingChoice.cardOptions
    : [];
}

function resolve(state: GameState, result: CardEffectResult): GameState {
  return {
    ...applyEvents(state, result.events),
    pendingChoice: result.pendingChoice ?? null,
  };
}

describe("Library", () => {
  it("does nothing with seven cards or a missing player", () => {
    const state = createTestState();
    state.players.human!.hand = Array(7).fill("Copper");
    expect(library({ state, playerId: "human", card: "Library" })).toEqual({
      events: [],
    });
    expect(library({ state, playerId: "missing", card: "Library" })).toEqual({
      events: [],
    });
  });

  it("draws ordinary cards until seven, leaving excess cards in the deck", () => {
    const state = createTestState();
    state.players.human!.hand = Array(5).fill("Copper");
    state.players.human!.deck = ["Gold", "Silver", "Estate"];
    const after = resolve(
      state,
      library({ state, playerId: "human", card: "Library" }),
    );
    expect(after.players.human!.hand).toEqual([
      ...Array(5).fill("Copper"),
      "Estate",
      "Silver",
    ]);
    expect(after.players.human!.deck).toEqual(["Gold"]);
    expect(after.pendingChoice).toBeNull();
  });

  it("asks about one Action at a time and resumes through a serialized choice", () => {
    let state = createTestState();
    state.players.human!.hand = Array(4).fill("Copper");
    state.players.human!.deck = [
      "Gold",
      "Smithy",
      "Silver",
      "Village",
      "Estate",
    ];
    state = resolve(
      state,
      library({ state, playerId: "human", card: "Library" }),
    );
    expect(state.players.human!.hand.length).toBe(5);
    expect(options(state)).toEqual(["Village"]);
    expect(state.players.human!.setAside).toEqual(["Village"]);
    state = JSON.parse(JSON.stringify(state));
    state = resolve(
      state,
      library({
        state,
        playerId: "human",
        card: "Library",
        stage: "keep-or-skip",
        decision: { selectedCards: [], cardActions: { 0: "discard_card" } },
      }),
    );
    expect(state.players.human!.hand.length).toBe(6);
    expect(options(state)).toEqual(["Smithy"]);
    expect(state.players.human!.discard).toEqual([]);
    expect(state.players.human!.setAside).toEqual(["Village", "Smithy"]);
    state = resolve(
      state,
      library({
        state,
        playerId: "human",
        card: "Library",
        stage: "keep-or-skip",
        decision: { selectedCards: [], cardActions: { 0: "draw_card" } },
      }),
    );
    expect(state.players.human!.hand.at(-1)).toBe("Smithy");
    expect(state.players.human!.hand.length).toBe(7);
    expect(state.players.human!.deck).toEqual(["Gold"]);
    expect(state.players.human!.discard).toEqual(["Village"]);
    expect(state.players.human!.setAside).toEqual([]);
    expect(state.pendingChoice).toBeNull();
  });

  it("does not reshuffle skipped Actions and stops when all available cards are exhausted", () => {
    let state = createTestState();
    state.players.human!.deck = ["Village"];
    state.players.human!.discard = ["Silver", "Copper"];
    state = resolve(
      state,
      library({ state, playerId: "human", card: "Library" }),
    );
    const result = library({
      state,
      playerId: "human",
      card: "Library",
      decision: { selectedCards: [], cardActions: { 0: "discard_card" } },
    });
    const after = resolve(state, result);
    expect(after.players.human!.hand.slice().sort()).toEqual([
      "Copper",
      "Silver",
    ]);
    expect(after.players.human!.discard).toEqual(["Village"]);
    expect(after.players.human!.deck).toEqual([]);
    expect(after.players.human!.setAside).toEqual([]);
    expect(after.pendingChoice).toBeNull();
    expect(resolve(state, JSON.parse(JSON.stringify(result)))).toEqual(after);
  });

  it("keeps duplicate Actions as separate choices and conserves every card", () => {
    let state = createTestState();
    state.players.human!.deck = ["Village", "Village"];
    state = resolve(
      state,
      library({ state, playerId: "human", card: "Library" }),
    );
    state = resolve(
      state,
      library({
        state,
        playerId: "human",
        card: "Library",
        decision: { selectedCards: [], cardActions: { 0: "discard_card" } },
      }),
    );
    state = resolve(
      state,
      library({
        state,
        playerId: "human",
        card: "Library",
        decision: { selectedCards: [], cardActions: { 0: "draw_card" } },
      }),
    );
    expect(state.players.human!.hand).toEqual(["Village"]);
    expect(state.players.human!.discard).toEqual(["Village"]);
    expect(state.players.human!.setAside).toEqual([]);
    expect(state.pendingChoice).toBeNull();
  });
});
