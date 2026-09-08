import { describe, it, expect } from "bun:test";
import { vassal } from "./vassal";
import type { GameState, CardName } from "../../types/game-state";

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

function context(state: GameState, playerId = "human") {
  return {
    state,
    playerId,
    card: "Vassal" as const,
    trigger: { type: "play" as const },
    random: () => 0.5,
  };
}
describe("Vassal", () => {
  it("grants coins with an empty deck", () => {
    const result = vassal.run(context(createTestState()), { type: "start" });
    expect(result).toEqual({
      type: "done",
      events: [{ type: "COINS_MODIFIED", delta: 2 }],
    });
  });
  it.each([
    "Copper",
    "Silver",
    "Gold",
    "Estate",
    "Duchy",
    "Province",
  ] as CardName[])("discards %s without a choice", card => {
    const state = createTestState();
    state.players.human!.deck = [card];
    const result = vassal.run(context(state), { type: "start" });
    expect(result.type).toBe("done");
    expect(result.events).toContainEqual({ type: "COINS_MODIFIED", delta: 2 });
    expect(result.events).toContainEqual({
      type: "CARD_DISCARDED",
      playerId: "human",
      card,
      from: "deck",
    });
  });
  it.each([
    "Village",
    "Smithy",
    "Market",
    "Militia",
    "Throne Room",
  ] as CardName[])("offers to play discarded %s", card => {
    const state = createTestState();
    state.players.human!.deck = [card];
    const result = vassal.run(context(state), { type: "start" });
    expect(result.type).toBe("choice");
    if (result.type !== "choice") throw new Error("Expected choice");
    expect(result.request).toMatchObject({
      cardOptions: [card],
      min: 0,
      max: 1,
      intent: "play",
      from: "discard",
    });
    expect(result.memory).toEqual({ discarded: card });
    expect(result.events).toContainEqual({
      type: "CARD_DISCARDED",
      playerId: "human",
      card,
      from: "deck",
    });
  });
  it("schedules the chosen Action without applying its benefits twice", () => {
    const state = createTestState();
    state.players.human!.discard = ["Village"];
    const result = vassal.run(context(state), {
      type: "answer",
      memory: { discarded: "Village" },
      answer: { selectedCards: ["Village"] },
    });
    expect(result).toEqual({
      type: "schedule",
      events: [],
      operations: [
        { type: "play", playerId: "human", card: "Village", from: "discard" },
      ],
    });
  });
  it("does nothing when declined or the player is missing", () => {
    const state = createTestState();
    expect(
      vassal.run(context(state), {
        type: "answer",
        memory: { discarded: "Village" },
        answer: { selectedCards: [] },
      }),
    ).toEqual({ type: "done", events: [] });
    expect(
      vassal.run(context(state, "missing"), { type: "start" }).events,
    ).toEqual([]);
  });
  it("records a shuffle before discarding its top card", () => {
    const state = createTestState();
    state.players.human!.discard = ["Village"];
    const result = vassal.run(context(state), { type: "start" });
    expect(result.events.map(event => event.type)).toEqual([
      "COINS_MODIFIED",
      "DECK_SHUFFLED",
      "CARD_DISCARDED",
    ]);
    expect(result.type).toBe("choice");
  });
  it("rejects malformed continuation memory instead of silently ignoring stages", () => {
    expect(() => vassal.parseMemory({ stage: "unknown_stage" })).toThrow();
    expect(() => vassal.parseMemory({ discarded: "Imaginary" })).toThrow();
  });
});
