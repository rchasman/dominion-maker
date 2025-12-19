/**
 * TDD test to verify Militia triggers discard modal for opponents
 * Tests the bug where the decision modal doesn't appear when opponent plays Militia
 */

import { describe, it, expect, beforeEach } from "bun:test";
import type { GameState } from "../types/game-state";
import { handleCommand } from "../commands/handle";
import { resetEventCounter } from "../events/id-generator";
import { applyEvents } from "../events/apply";

function createMilitiaGameState(): GameState {
  return {
    players: {
      human: {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate", "Duchy"], // 5 cards, needs to discard 2
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai1: {
        deck: [],
        hand: ["Militia", "Copper"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Copper: 40,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
      Militia: 10,
    },
    activePlayerId: "ai1",
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    playerOrder: ["ai1", "human"],
    turnNumber: 1,
    trash: [],
    turnHistory: [],
    log: [],
  };
}

describe("Militia Discard Modal Bug", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should create decision modal when opponent plays Militia and I have >3 cards", () => {
    const state = createMilitiaGameState();

    // AI plays Militia
    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "ai1" },
      "ai1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Command failed: ${result.error}`);

    console.log(
      "Events after Militia:",
      result.events.map(e => e.type),
    );

    // Should have ATTACK_DECLARED
    const attackDeclared = result.events.find(
      e => e.type === "ATTACK_DECLARED",
    );
    expect(attackDeclared).toBeDefined();

    // Should have ATTACK_RESOLVED for human (no reactions, not blocked)
    const attackResolved = result.events.find(
      e => e.type === "ATTACK_RESOLVED" && e.target === "human",
    );
    expect(attackResolved).toBeDefined();
    if (!attackResolved || attackResolved.type !== "ATTACK_RESOLVED")
      throw new Error("No attack resolved");
    expect(attackResolved.blocked).toBe(false);

    // THE BUG: Should have DECISION_REQUIRED for human to discard down to 3
    const decisionEvent = result.events.find(
      e => e.type === "DECISION_REQUIRED",
    );
    expect(decisionEvent).toBeDefined();
    if (!decisionEvent || decisionEvent.type !== "DECISION_REQUIRED") {
      throw new Error("No decision event - BUG: Modal not appearing!");
    }

    expect(decisionEvent.decision.playerId).toBe("human");
    expect(decisionEvent.decision.stage).toBe("opponent_discard");
    expect(decisionEvent.decision.cardBeingPlayed).toBe("Militia");
    expect(decisionEvent.decision.min).toBe(2); // 5 - 3 = 2 cards to discard
    expect(decisionEvent.decision.max).toBe(2);

    // Verify the modal shows up in the state
    const newState = applyEvents(state, result.events);
    expect(newState.pendingChoice).toBeDefined();
    expect(newState.pendingChoice?.playerId).toBe("human");
    expect(newState.pendingChoice?.choiceType).toBe("decision");
  });

  it("should NOT create decision if opponent has exactly 3 cards", () => {
    const state = createMilitiaGameState();
    // Give human exactly 3 cards
    state.players.human!.hand = ["Copper", "Silver", "Gold"];

    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "ai1" },
      "ai1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Command failed: ${result.error}`);

    // Should NOT have DECISION_REQUIRED (no need to discard)
    const decisionEvent = result.events.find(
      e => e.type === "DECISION_REQUIRED",
    );
    expect(decisionEvent).toBeUndefined();
  });

  it("should NOT create decision if opponent has <3 cards", () => {
    const state = createMilitiaGameState();
    // Give human only 2 cards
    state.players.human!.hand = ["Copper", "Silver"];

    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "ai1" },
      "ai1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Command failed: ${result.error}`);

    // Should NOT have DECISION_REQUIRED (no need to discard)
    const decisionEvent = result.events.find(
      e => e.type === "DECISION_REQUIRED",
    );
    expect(decisionEvent).toBeUndefined();
  });
});
