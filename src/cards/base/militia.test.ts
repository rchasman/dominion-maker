import { describe, it, expect } from "bun:test";
import { militia } from "./militia";
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
    card: "Militia" as const,
    trigger: { type: "attack" as const, target: "ai" },
    random: () => 0.5,
  };
}

describe("Militia", () => {
  it("grants coins and schedules target resolution separately", () => {
    const state = createTestState();
    expect(
      militia.run(
        { ...context(state), trigger: { type: "play" } },
        { type: "start" },
      ),
    ).toEqual({
      type: "schedule",
      events: [{ type: "COINS_MODIFIED", delta: 2 }],
      operations: [{ type: "attack", targets: ["ai"] }],
    });
  });
  it("requires exactly enough discards and resumes without UI state", () => {
    let state = createTestState();
    state.players.ai!.hand = ["Estate", "Copper", "Copper", "Silver", "Gold"];
    const initial = militia.run(context(state), { type: "start" });
    if (initial.type !== "choice") throw new Error("Expected choice");
    expect(initial.request).toMatchObject({
      playerId: "ai",
      min: 2,
      max: 2,
      intent: "discard",
    });
    const result = militia.run(context(state), {
      type: "answer",
      memory: initial.memory,
      answer: { selectedCards: ["Estate", "Copper"] },
    });
    state = applyEvents(state, result.events);
    expect(state.players.ai!.hand).toEqual(["Copper", "Silver", "Gold"]);
    expect(state.players.ai!.discard).toEqual(["Estate", "Copper"]);
    expect(state.coins).toBe(0);
    expect(result.type).toBe("done");
  });
  it("does not prompt targets with three cards or missing targets", () => {
    const state = createTestState();
    state.players.ai!.hand = ["Copper", "Copper", "Copper"];
    expect(militia.run(context(state), { type: "start" }).type).toBe("done");
    delete state.players.ai;
    expect(militia.run(context(state), { type: "start" }).events).toEqual([]);
  });
});
