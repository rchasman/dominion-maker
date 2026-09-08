import { describe, it, expect } from "bun:test";
import { sentry } from "./sentry";
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

describe("Sentry", () => {
  it("draws before looking at the next two cards", () => {
    const state = createTestState();
    state.players.human!.deck = ["Gold", "Silver", "Estate", "Copper"];
    const after = resolve(
      state,
      sentry({ state, playerId: "human", card: "Sentry" }),
    );
    expect(after.players.human!.hand).toEqual(["Copper"]);
    expect(after.players.human!.deck).toEqual(["Gold"]);
    expect(after.players.human!.setAside).toEqual(["Estate", "Silver"]);
    expect(options(after)).toEqual(["Estate", "Silver"]);
    expect(after.actions).toBe(2);
  });

  it("trashes and discards looked-at cards without touching duplicates in hand", () => {
    let state = createTestState();
    state.players.human!.hand = ["Estate", "Silver"];
    state.players.human!.deck = ["Silver", "Estate", "Copper"];
    state = resolve(
      state,
      sentry({ state, playerId: "human", card: "Sentry" }),
    );
    state = JSON.parse(JSON.stringify(state));
    state = resolve(
      state,
      sentry({
        state,
        playerId: "human",
        card: "Sentry",
        stage: "sort",
        decision: {
          selectedCards: [],
          cardActions: { 0: "trash_card", 1: "discard_card" },
        },
      }),
    );
    expect(state.players.human!.hand).toEqual(["Estate", "Silver", "Copper"]);
    expect(state.players.human!.discard).toEqual(["Silver"]);
    expect(state.trash).toEqual(["Estate"]);
    expect(state.players.human!.setAside).toEqual([]);
    expect(state.players.human!.deck).toEqual([]);
  });

  it("topdecks in the requested order without creating or taking cards from hand", () => {
    let state = createTestState();
    state.players.human!.hand = ["Estate"];
    state.players.human!.deck = ["Gold", "Silver", "Estate", "Copper"];
    state = resolve(
      state,
      sentry({ state, playerId: "human", card: "Sentry" }),
    );
    state = resolve(
      state,
      sentry({
        state,
        playerId: "human",
        card: "Sentry",
        decision: {
          selectedCards: [],
          cardActions: { 0: "topdeck_card", 1: "topdeck_card" },
          cardOrder: [1, 0],
        },
      }),
    );
    expect(state.players.human!.hand).toEqual(["Estate", "Copper"]);
    expect(state.players.human!.deck).toEqual(["Gold", "Estate", "Silver"]);
    expect(state.players.human!.setAside).toEqual([]);
  });

  it("preserves duplicate looked-at cards independently", () => {
    let state = createTestState();
    state.players.human!.deck = ["Estate", "Estate", "Copper"];
    state = resolve(
      state,
      sentry({ state, playerId: "human", card: "Sentry" }),
    );
    state = resolve(
      state,
      sentry({
        state,
        playerId: "human",
        card: "Sentry",
        decision: {
          selectedCards: [],
          cardActions: { 0: "trash_card", 1: "topdeck_card" },
          cardOrder: [1],
        },
      }),
    );
    expect(state.players.human!.deck).toEqual(["Estate"]);
    expect(state.trash).toEqual(["Estate"]);
    expect(state.players.human!.setAside).toEqual([]);
  });

  it("looks across a shuffle, recording the same order used by replay", () => {
    let state = createTestState();
    state.players.human!.deck = ["Estate", "Copper"];
    state.players.human!.discard = ["Gold", "Silver"];
    const before = state;
    const result = sentry({ state, playerId: "human", card: "Sentry" });
    state = resolve(state, result);
    expect(options(state)[0]).toBe("Estate");
    expect(state.players.human!.setAside?.length).toBe(2);
    expect(state.players.human!.deck.length).toBe(1);
    expect(state.players.human!.discard).toEqual([]);
    expect(resolve(before, JSON.parse(JSON.stringify(result)))).toEqual(state);
    state = resolve(
      state,
      sentry({
        state,
        playerId: "human",
        card: "Sentry",
        decision: {
          selectedCards: [],
          cardActions: { 0: "topdeck_card", 1: "topdeck_card" },
          cardOrder: [0, 1],
        },
      }),
    );
    expect(
      [...state.players.human!.hand, ...state.players.human!.deck]
        .slice()
        .sort(),
    ).toEqual(["Copper", "Estate", "Gold", "Silver"]);
    expect(state.players.human!.setAside).toEqual([]);
  });

  it("handles zero or one available card after drawing", () => {
    const empty = createTestState();
    expect(
      sentry({ state: empty, playerId: "human", card: "Sentry" }).pendingChoice,
    ).toBeUndefined();
    empty.players.human!.deck = ["Copper"];
    const after = resolve(
      empty,
      sentry({ state: empty, playerId: "human", card: "Sentry" }),
    );
    expect(after.players.human!.hand).toEqual(["Copper"]);
    expect(after.pendingChoice).toBeNull();
    empty.players.human!.deck = ["Silver", "Copper"];
    expect(
      sentry({ state: empty, playerId: "human", card: "Sentry" }).pendingChoice
        ?.cardOptions,
    ).toEqual(["Silver"]);
    expect(
      sentry({ state: empty, playerId: "missing", card: "Sentry" }).events,
    ).toEqual([]);
  });
});
