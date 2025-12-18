/**
 * Test for Militia attack with reaction flow
 * This tests the specific bug where opponent decisions weren't created
 * after reactions were resolved.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import type { GameState, CardName } from "../types/game-state";
import { handleCommand } from "../commands/handle";
import { resetEventCounter } from "../events/id-generator";
import type { GameEvent } from "../events/types";
import { applyEvents } from "../events/apply";

function createTestState(): GameState {
  return {
    players: {
      human: {
        deck: [],
        hand: ["Militia"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai1: {
        deck: [],
        hand: ["Moat", "Copper", "Silver", "Gold", "Estate"], // Has Moat, blocks attack
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      ai2: {
        deck: [],
        hand: ["Copper", "Silver", "Gold", "Estate", "Duchy"], // No Moat, should need to discard
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
      Moat: 10,
    },
    activePlayerId: "human",
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    playerOrder: ["human", "ai1", "ai2"],
    turnNumber: 1,
    trash: [],
    turnHistory: [],
    log: [],
  };
}

describe("Militia with Reaction Flow", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("should create REACTION_OPPORTUNITY for first opponent with Moat", () => {
    const state = createTestState();

    const result = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
      "human",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Command failed: ${result.error}`);

    // Should have ATTACK_DECLARED
    const attackDeclared = result.events.find(e => e.type === "ATTACK_DECLARED");
    expect(attackDeclared).toBeDefined();

    // Should have REACTION_OPPORTUNITY for ai1 (who has Moat)
    const reactionOpp = result.events.find(e => e.type === "REACTION_OPPORTUNITY");
    expect(reactionOpp).toBeDefined();
    if (!reactionOpp || reactionOpp.type !== "REACTION_OPPORTUNITY")
      throw new Error("No reaction opportunity");
    expect(reactionOpp.playerId).toBe("ai1");
    expect(reactionOpp.availableReactions).toContain("Moat");

    // Should NOT have DECISION_REQUIRED yet (waiting for reactions)
    const decisionEvent = result.events.find(e => e.type === "DECISION_REQUIRED");
    expect(decisionEvent).toBeUndefined();
  });

  it("should create opponent discard decision after first opponent reveals Moat", () => {
    const state = createTestState();

    // First, play Militia
    const playResult = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
      "human",
    );

    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

    // Apply events to get new state
    const midState = applyEvents(state, playResult.events);

    // Now ai1 reveals Moat
    const reactionResult = handleCommand(
      midState,
      { type: "REVEAL_REACTION", card: "Moat", playerId: "ai1" },
      "ai1",
    );

    expect(reactionResult.ok).toBe(true);
    if (!reactionResult.ok) throw new Error(`Reaction failed: ${reactionResult.error}`);

    console.log("Events after Moat reveal:", reactionResult.events.map(e => e.type));

    // Should have REACTION_REVEALED
    const reactionRevealed = reactionResult.events.find(
      e => e.type === "REACTION_REVEALED",
    );
    expect(reactionRevealed).toBeDefined();

    // Should have ATTACK_RESOLVED with blocked: true for ai1
    const attackResolved = reactionResult.events.find(
      e => e.type === "ATTACK_RESOLVED" && e.target === "ai1",
    );
    expect(attackResolved).toBeDefined();
    if (!attackResolved || attackResolved.type !== "ATTACK_RESOLVED")
      throw new Error("No attack resolved event");
    expect(attackResolved.blocked).toBe(true);

    // THE BUG FIX: Should have DECISION_REQUIRED for ai2 to discard
    // This was missing before the fix - the pendingChoice was ignored
    const decisionEvent = reactionResult.events.find(
      e => e.type === "DECISION_REQUIRED",
    );
    expect(decisionEvent).toBeDefined();
    if (!decisionEvent || decisionEvent.type !== "DECISION_REQUIRED")
      throw new Error("No decision event - BUG NOT FIXED!");

    expect(decisionEvent.decision.playerId).toBe("ai2");
    expect(decisionEvent.decision.stage).toBe("opponent_discard");
    expect(decisionEvent.decision.cardBeingPlayed).toBe("Militia");
    expect(decisionEvent.decision.min).toBe(2); // 5 - 3 = 2 cards to discard
    expect(decisionEvent.decision.max).toBe(2);
  });

  it("should create opponent discard decision after first opponent declines Moat", () => {
    const state = createTestState();

    // First, play Militia
    const playResult = handleCommand(
      state,
      { type: "PLAY_ACTION", card: "Militia", playerId: "human" },
      "human",
    );

    expect(playResult.ok).toBe(true);
    if (!playResult.ok) throw new Error(`Play failed: ${playResult.error}`);

    // Apply events to get new state
    const midState = applyEvents(state, playResult.events);

    // Now ai1 declines to reveal Moat
    const reactionResult = handleCommand(
      midState,
      { type: "DECLINE_REACTION", playerId: "ai1" },
      "ai1",
    );

    expect(reactionResult.ok).toBe(true);
    if (!reactionResult.ok) throw new Error(`Reaction failed: ${reactionResult.error}`);

    console.log("Events after decline:", reactionResult.events.map(e => e.type));

    // Should have REACTION_DECLINED
    const reactionDeclined = reactionResult.events.find(
      e => e.type === "REACTION_DECLINED",
    );
    expect(reactionDeclined).toBeDefined();

    // Should have ATTACK_RESOLVED with blocked: false for ai1
    const attackResolved1 = reactionResult.events.find(
      e => e.type === "ATTACK_RESOLVED" && e.target === "ai1",
    );
    expect(attackResolved1).toBeDefined();
    if (!attackResolved1 || attackResolved1.type !== "ATTACK_RESOLVED")
      throw new Error("No attack resolved event for ai1");
    expect(attackResolved1.blocked).toBe(false);

    // Should check for reaction from ai2 (who has no reactions)
    // Since ai2 has no Moat, should auto-resolve and create DECISION_REQUIRED
    const attackResolved2 = reactionResult.events.find(
      e => e.type === "ATTACK_RESOLVED" && e.target === "ai2",
    );
    expect(attackResolved2).toBeDefined();
    if (!attackResolved2 || attackResolved2.type !== "ATTACK_RESOLVED")
      throw new Error("No attack resolved event for ai2");
    expect(attackResolved2.blocked).toBe(false);

    // THE BUG FIX: Should have DECISION_REQUIRED for ai1 to discard
    const decisionEvents = reactionResult.events.filter(
      e => e.type === "DECISION_REQUIRED",
    );
    expect(decisionEvents.length).toBeGreaterThan(0);

    // Should have decision for ai1 first (since they didn't block)
    const decision1 = decisionEvents.find(
      e =>
        e.type === "DECISION_REQUIRED" &&
        e.decision.playerId === "ai1" &&
        e.decision.stage === "opponent_discard",
    );
    expect(decision1).toBeDefined();
    if (!decision1 || decision1.type !== "DECISION_REQUIRED")
      throw new Error("No decision event for ai1 - BUG NOT FIXED!");

    expect(decision1.decision.cardBeingPlayed).toBe("Militia");
    expect(decision1.decision.min).toBe(2); // 5 - 3 = 2 cards to discard
  });
});
