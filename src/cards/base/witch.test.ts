import { describe, it, expect } from "bun:test";
import { witch } from "./witch";
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
    card: "Witch" as const,
    trigger: { type: "attack" as const, target: "ai" },
    random: () => 0.5,
  };
}

describe("Witch", () => {
  it("draws two and schedules attacks without giving Curses early", () => {
    const state = createTestState();
    state.players.human!.deck = ["Gold", "Silver", "Copper"];
    const result = witch.run(
      { ...context(state), trigger: { type: "play" } },
      { type: "start" },
    );
    expect(result.type).toBe("schedule");
    expect(applyEvents(state, result.events).players.human!.hand).toEqual([
      "Copper",
      "Silver",
    ]);
    expect(result.events.some(event => event.type === "CARD_GAINED")).toBe(
      false,
    );
  });
  it("gives only the current target a Curse and observes depletion before the next target", () => {
    const state = createTestState();
    state.supply.Curse = 1;
    const result = witch.run(context(state), { type: "start" });
    expect(result).toEqual({
      type: "done",
      events: [
        { type: "CARD_GAINED", playerId: "ai", card: "Curse", to: "discard" },
      ],
    });
    const after = applyEvents(state, result.events);
    expect(after.players.ai!.discard).toEqual(["Curse"]);
    expect(after.supply.Curse).toBe(0);
    expect(witch.run(context(after), { type: "start" }).events).toEqual([]);
  });
});
