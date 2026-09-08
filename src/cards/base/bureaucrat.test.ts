import { describe, it, expect } from "bun:test";
import { bureaucrat } from "./bureaucrat";
import type { GameState, CardName } from "../../types/game-state";
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

function context(state: GameState) {
  return {
    state,
    playerId: "human",
    card: "Bureaucrat" as const,
    trigger: { type: "attack" as const, target: "ai" },
    random: () => 0.5,
  };
}

describe("Bureaucrat", () => {
  it("gains Silver on deck only when available and always schedules attacks", () => {
    const state = createTestState();
    state.supply.Silver = 1;
    const result = bureaucrat.run(
      { ...context(state), trigger: { type: "play" } },
      { type: "start" },
    );
    expect(result.type).toBe("schedule");
    expect(applyEvents(state, result.events).players.human!.deck).toEqual([
      "Silver",
    ]);
    state.supply.Silver = 0;
    const empty = bureaucrat.run(
      { ...context(state), trigger: { type: "play" } },
      { type: "start" },
    );
    expect(empty.type).toBe("schedule");
    expect(empty.events).toEqual([]);
  });
  it("offers only Victory cards and topdecks the selected copy", () => {
    const state = createTestState();
    state.players.ai!.hand = ["Estate", "Estate", "Silver", "Duchy"];
    const initial = bureaucrat.run(context(state), { type: "start" });
    if (initial.type !== "choice") throw new Error("Expected choice");
    expect(initial.request.cardOptions).toEqual(["Estate", "Estate", "Duchy"]);
    expect(initial.request).toMatchObject({
      playerId: "ai",
      min: 1,
      max: 1,
      intent: "topdeck",
    });
    const result = bureaucrat.run(context(state), {
      type: "answer",
      memory: initial.memory,
      answer: { selectedCards: ["Estate"] },
    });
    const after = applyEvents(state, result.events);
    expect(after.players.ai!.hand).toEqual(["Estate", "Silver", "Duchy"]);
    expect(after.players.ai!.deck).toEqual(["Estate"]);
  });
  it("reveals every card when no Victory card is held", () => {
    const state = createTestState();
    state.players.ai!.hand = ["Copper", "Silver"];
    const result = bureaucrat.run(context(state), { type: "start" });
    expect(result.type).toBe("done");
    expect(result.events).toEqual(
      state.players.ai!.hand.map(card => ({
        type: "CARD_REVEALED",
        playerId: "ai",
        card,
        from: "hand",
      })),
    );
    expect(applyEvents(state, result.events).players.ai!.hand).toEqual([
      "Copper",
      "Silver",
    ]);
  });
});
