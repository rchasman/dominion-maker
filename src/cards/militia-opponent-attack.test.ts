/**
 * TDD test for when OPPONENT plays Militia against YOU
 * This tests the specific scenario the user is experiencing
 */

import { describe, it, expect, beforeEach } from "bun:test";
import type { GameState } from "../types/game-state";
import { handleCommand } from "../commands/handle";
import { resetEventCounter } from "../events/id-generator";
import { applyEvents } from "../events/apply";

function createOpponentAttackState(): GameState {
  return {
    players: {
      ai1: {
        deck: [],
        hand: ["Militia"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      human: {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate", "Duchy"], // 5 cards - must discard 2
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
    activePlayerId: "ai1", // AI's turn, not human's
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

describe("Opponent Plays Militia Against You", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should create decision modal when AI opponent plays Militia", () => {
    const state = createOpponentAttackState();

    // AI plays Militia against human
    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "ai1" },
      "ai1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Command failed: ${result.error}`);

    console.log(
      "\nEvents when opponent plays Militia:",
      result.events.map(e => ({
        type: e.type,
        ...(e.type === "DECISION_REQUIRED"
          ? { playerId: e.decision.playerId }
          : {}),
      })),
    );

    // Should have DECISION_REQUIRED for human
    const decisionEvent = result.events.find(
      e => e.type === "DECISION_REQUIRED",
    );
    expect(decisionEvent).toBeDefined();
    if (!decisionEvent || decisionEvent.type !== "DECISION_REQUIRED") {
      throw new Error("BUG: No decision event - modal won't appear!");
    }

    expect(decisionEvent.decision.playerId).toBe("human");
    expect(decisionEvent.decision.stage).toBe("opponent_discard");

    // Apply events and check pendingChoice is set correctly
    const newState = applyEvents(state, result.events);
    expect(newState.pendingChoice).toBeDefined();
    expect(newState.pendingChoice?.playerId).toBe("human");
    expect(newState.pendingChoice?.choiceType).toBe("decision");

    console.log("\nPending choice after applying events:", {
      playerId: newState.pendingChoice?.playerId,
      choiceType: newState.pendingChoice?.choiceType,
      stage:
        newState.pendingChoice?.choiceType === "decision"
          ? newState.pendingChoice.stage
          : null,
    });
  });

  it("should show prompt mentioning Militia and discard count", () => {
    const state = createOpponentAttackState();

    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "ai1" },
      "ai1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Command failed: ${result.error}`);

    const decisionEvent = result.events.find(
      e => e.type === "DECISION_REQUIRED",
    );
    if (!decisionEvent || decisionEvent.type !== "DECISION_REQUIRED") {
      throw new Error("No decision event");
    }

    // Check the prompt is user-friendly
    expect(decisionEvent.decision.prompt).toContain("Militia");
    expect(decisionEvent.decision.prompt).toContain("discard 2");
  });

  it("should handle discard decision and update hand correctly", () => {
    const state = createOpponentAttackState();

    // Step 1: AI plays Militia
    const playResult = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "ai1" },
      "ai1",
    );

    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error(`Play failed`);

    const midState = applyEvents(state, playResult.events);

    // Verify human can click and select cards even though it's not their turn
    expect(midState.activePlayerId).toBe("ai1"); // Still AI's turn
    expect(midState.pendingChoice?.playerId).toBe("human"); // But human has decision

    // Step 2: Human discards 2 cards
    const discardResult = handleCommand(
      midState,
      {
        type: "SUBMIT_DECISION",
        playerId: "human",
        choice: {
          selectedCards: ["Copper", "Estate"],
        },
      },
      "human",
    );

    expect(discardResult.ok).toBe(true);
    if (!discardResult.ok) throw new Error(`Discard failed`);

    const finalState = applyEvents(midState, discardResult.events);

    // Human should now have 3 cards in hand
    expect(finalState.players.human?.hand.length).toBe(3);
    expect(finalState.players.human?.hand).toEqual(["Silver", "Gold", "Duchy"]);

    // Discarded cards should be in discard pile
    expect(finalState.players.human?.discard).toContain("Copper");
    expect(finalState.players.human?.discard).toContain("Estate");

    // No more pending choice
    expect(finalState.pendingChoice).toBeNull();
  });
});
