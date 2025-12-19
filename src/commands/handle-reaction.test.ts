import { describe, test, expect, beforeEach } from "bun:test";
import { handleRevealReaction, handleDeclineReaction } from "./handle-reaction";
import { resetEventCounter } from "../events/id-generator";
import type { GameState } from "../types/game-state";
import type { ReactionChoice } from "../types/pending-choice";

function createMockState(): GameState {
  return {
    players: {
      p1: {
        deck: ["Copper"],
        hand: ["Moat", "Estate"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      p2: {
        deck: ["Copper"],
        hand: ["Witch"],
        discard: [],
        inPlay: ["Witch"],
        inPlaySourceIndices: [0],
      },
      p3: {
        deck: ["Copper"],
        hand: ["Estate"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Village: 10,
      Witch: 10,
      Moat: 10,
      Copper: 40,
      Estate: 8,
    },
    kingdomCards: ["Village", "Witch", "Moat"],
    playerOrder: ["p1", "p2", "p3"],
    turn: 1,
    phase: "action",
    activePlayerId: "p2",
    actions: 0,
    buys: 1,
    coins: 0,
    gameOver: false,
    winnerId: null,
    pendingChoice: null,
    pendingChoiceEventId: null,
    trash: [],
    log: [],
    turnHistory: [],
    activeEffects: [],
  };
}

describe("handle-reaction - handleRevealReaction", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when no pending reaction", () => {
    const state = createMockState();
    state.pendingChoice = null;

    const result = handleRevealReaction(state, "p1", "Moat");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No pending reaction");
  });

  test("should return error when pending choice is not a reaction", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
    };

    const result = handleRevealReaction(state, "p1", "Moat");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No pending reaction");
  });

  test("should return error when metadata is missing", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
    } as ReactionChoice;

    const result = handleRevealReaction(state, "p1", "Moat");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Missing reaction metadata");
  });

  test("should return error when wrong player reveals", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleRevealReaction(state, "p3", "Moat");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not your reaction to reveal");
  });

  test("should return error when card not available to reveal", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleRevealReaction(state, "p1", "Horse");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Card not available to reveal");
  });

  test("should reveal reaction and block attack", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleRevealReaction(state, "p1", "Moat");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const revealedEvent = result.events.find(
      e => e.type === "REACTION_REVEALED",
    );
    expect(revealedEvent).toBeDefined();

    const playedEvent = result.events.find(e => e.type === "REACTION_PLAYED");
    expect(playedEvent).toBeDefined();

    const resolvedEvent = result.events.find(
      e => e.type === "ATTACK_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
    expect(resolvedEvent?.blocked).toBe(true);
  });

  test("should process next target after revealing reaction", () => {
    const state = createMockState();
    state.players.p3!.hand = ["Moat"];
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleRevealReaction(state, "p1", "Moat");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have REACTION_OPPORTUNITY for next target
    const nextOpportunity = result.events.find(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    expect(nextOpportunity).toBeDefined();
    expect(nextOpportunity?.playerId).toBe("p3");
  });

  test("should apply attack when last target reveals reaction", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p3",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 1,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-3";

    const result = handleRevealReaction(state, "p3", "Moat");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should NOT have REACTION_OPPORTUNITY (no more targets)
    const nextOpportunity = result.events.find(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    expect(nextOpportunity).toBeUndefined();
  });
});

describe("handle-reaction - handleDeclineReaction", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when no pending reaction", () => {
    const state = createMockState();
    state.pendingChoice = null;

    const result = handleDeclineReaction(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No pending reaction");
  });

  test("should return error when pending choice is not a reaction", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
    };

    const result = handleDeclineReaction(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No pending reaction");
  });

  test("should return error when metadata is missing", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
    } as ReactionChoice;

    const result = handleDeclineReaction(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Missing reaction metadata");
  });

  test("should return error when wrong player declines", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleDeclineReaction(state, "p3");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not your reaction to decline");
  });

  test("should decline reaction and not block attack", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleDeclineReaction(state, "p1");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const declinedEvent = result.events.find(
      e => e.type === "REACTION_DECLINED",
    );
    expect(declinedEvent).toBeDefined();

    const resolvedEvent = result.events.find(
      e => e.type === "ATTACK_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
    expect(resolvedEvent?.blocked).toBe(false);
  });

  test("should process next target after declining reaction", () => {
    const state = createMockState();
    state.players.p3!.hand = ["Moat"];
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleDeclineReaction(state, "p1");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have REACTION_OPPORTUNITY for next target
    const nextOpportunity = result.events.find(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    expect(nextOpportunity).toBeDefined();
    expect(nextOpportunity?.playerId).toBe("p3");
  });

  test("should apply attack when last target declines reaction", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p3",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: [],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 1,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-3";

    const result = handleDeclineReaction(state, "p3");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should NOT have REACTION_OPPORTUNITY (no more targets)
    const nextOpportunity = result.events.find(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    expect(nextOpportunity).toBeUndefined();
  });

  test("should auto-resolve next target without reactions", () => {
    const state = createMockState();
    state.players.p3!.hand = ["Estate"]; // No reactions
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1", "p3"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleDeclineReaction(state, "p1");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have auto-resolved for p3 (no reaction opportunity)
    const attackResolved = result.events.filter(
      e => e.type === "ATTACK_RESOLVED",
    );
    expect(attackResolved.length).toBeGreaterThan(0);
  });
});

describe("handle-reaction - Edge cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should handle pendingChoiceEventId as null", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = null;

    const result = handleRevealReaction(state, "p1", "Moat");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle single target with reaction", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["p1"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt-1",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleRevealReaction(state, "p1", "Moat");
    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should not have next REACTION_OPPORTUNITY
    const nextOpportunity = result.events.find(
      e => e.type === "REACTION_OPPORTUNITY",
    );
    expect(nextOpportunity).toBeUndefined();
  });
});
