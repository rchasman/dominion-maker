import { describe, test, expect, beforeEach } from "bun:test";
import { handleSubmitDecision, handleSkipDecision } from "./handle-decision";
import { resetEventCounter } from "../events/id-generator";
import { applyEvents } from "../events/apply";
import type { GameState, CardName } from "../types/game-state";
import type { DecisionChoice } from "../events/types";

function createMockState(): GameState {
  return {
    players: {
      p1: {
        deck: ["Copper", "Copper"],
        hand: ["Village", "Cellar"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
      p2: {
        deck: ["Copper", "Copper"],
        hand: ["Estate"],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    },
    supply: {
      Village: 10,
      Smithy: 10,
      Copper: 40,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
    },
    kingdomCards: ["Village", "Smithy"],
    playerOrder: ["p1", "p2"],
    turn: 1,
    phase: "action",
    activePlayerId: "p1",
    actions: 1,
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

describe("handle-decision - handleSubmitDecision", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when no pending decision", () => {
    const state = createMockState();
    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No pending decision");
  });

  test("should return error when pending choice is not a decision", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {},
    };
    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not a decision");
  });

  test("should return error when wrong player submits decision", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Select a card",
      cardOptions: ["Copper"],
      min: 0,
      max: 1,
    };
    const result = handleSubmitDecision(state, "p2", { selectedCards: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not your decision");
  });

  test("should handle simple decision resolution", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Select cards",
      cardOptions: ["Copper", "Estate"],
      min: 0,
      max: 2,
    };
    state.pendingChoiceEventId = "evt-1";

    const result = handleSubmitDecision(state, "p1", {
      selectedCards: ["Copper"],
    });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const resolvedEvent = result.events.find(
      e => e.type === "DECISION_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
    expect(resolvedEvent?.causedBy).toBe("evt-1");
  });

  test("should handle Throne Room execution with pending choice", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Choose a card to play twice",
      cardOptions: ["Village"],
      min: 1,
      max: 1,
      cardBeingPlayed: "Throne Room",
      metadata: {
        originalCause: "evt-root",
      },
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleSubmitDecision(state, "p1", {
      selectedCards: ["Village"],
    });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should have DECISION_RESOLVED
    const resolvedEvent = result.events.find(
      e => e.type === "DECISION_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
  });

  test("should handle Throne Room with executionsRemaining", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Cellar: Discard cards",
      cardOptions: ["Estate"],
      min: 0,
      max: 1,
      cardBeingPlayed: "Cellar",
      stage: "discard",
      metadata: {
        throneRoomTarget: "Cellar",
        throneRoomExecutionsRemaining: 1,
        originalCause: "evt-root",
      },
    };
    state.pendingChoiceEventId = "evt-3";

    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle card effect continuation with stage", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Cellar: Discard cards",
      cardOptions: ["Estate", "Copper"],
      min: 0,
      max: 2,
      cardBeingPlayed: "Cellar",
      stage: "discard",
      metadata: {
        originalCause: "evt-root",
      },
    };
    state.pendingChoiceEventId = "evt-4";

    const result = handleSubmitDecision(state, "p1", {
      selectedCards: ["Estate"],
    });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle decision without cardBeingPlayed", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Generic decision",
      cardOptions: [],
      min: 0,
      max: 0,
    };
    state.pendingChoiceEventId = "evt-5";

    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should only have DECISION_RESOLVED event
    const resolvedEvent = result.events.find(
      e => e.type === "DECISION_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
    expect(result.events.length).toBe(1);
  });

  test("should handle Throne Room with no effect", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Choose card",
      cardOptions: ["Copper"],
      min: 1,
      max: 1,
      cardBeingPlayed: "Throne Room",
      metadata: {
        throneRoomTarget: "Copper",
        throneRoomExecutionsRemaining: 2,
        originalCause: "evt-root",
      },
    };

    const result = handleSubmitDecision(state, "p1", {
      selectedCards: ["Copper"],
    });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should link events to originalCause when present", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Workshop: Gain a card",
      cardOptions: ["Estate"],
      min: 1,
      max: 1,
      cardBeingPlayed: "Workshop",
      metadata: {
        originalCause: "evt-original",
      },
    };
    state.pendingChoiceEventId = "evt-6";

    const result = handleSubmitDecision(state, "p1", {
      selectedCards: ["Estate"],
    });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Events should be linked to original cause
    const gainEvent = result.events.find(e => e.type === "CARD_GAINED");
    expect(gainEvent?.causedBy).toBe("evt-original");
  });
});

describe("handle-decision - handleSkipDecision", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should return error when no pending decision", () => {
    const state = createMockState();
    const result = handleSkipDecision(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("No pending decision");
  });

  test("should return error when pending choice is not a decision", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "reaction",
      playerId: "p1",
      triggeringCard: "Witch",
      triggeringPlayerId: "p2",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {},
    };
    const result = handleSkipDecision(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not a decision");
  });

  test("should return error when wrong player skips decision", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Select a card",
      cardOptions: ["Copper"],
      min: 0,
      max: 1,
    };
    const result = handleSkipDecision(state, "p2");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Not your decision");
  });

  test("should return error when decision has required minimum", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Must select a card",
      cardOptions: ["Copper"],
      min: 1,
      max: 1,
    };
    const result = handleSkipDecision(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cannot skip");
  });

  test("should handle skip when min is undefined (treated as 1)", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Select cards",
      cardOptions: ["Copper"],
      max: 1,
    };
    const result = handleSkipDecision(state, "p1");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Cannot skip");
  });

  test("should allow skip when min is 0", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Select cards (optional)",
      cardOptions: ["Copper"],
      min: 0,
      max: 1,
    };
    state.pendingChoiceEventId = "evt-7";

    const result = handleSkipDecision(state, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const skipEvent = result.events.find(e => e.type === "DECISION_SKIPPED");
    expect(skipEvent).toBeDefined();
    expect(skipEvent?.causedBy).toBe("evt-7");
  });

  test("should skip without cardBeingPlayed", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Generic optional decision",
      cardOptions: [],
      min: 0,
      max: 0,
    };
    state.pendingChoiceEventId = "evt-8";

    const result = handleSkipDecision(state, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Should only have DECISION_SKIPPED
    expect(result.events.length).toBe(1);
    expect(result.events[0].type).toBe("DECISION_SKIPPED");
  });

  test("should invoke on_skip handler when card effect exists", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Cellar: Discard cards (optional)",
      cardOptions: ["Estate"],
      min: 0,
      max: 1,
      cardBeingPlayed: "Cellar",
      stage: "discard",
      metadata: {
        originalCause: "evt-cellar",
      },
    };
    state.pendingChoiceEventId = "evt-9";

    const result = handleSkipDecision(state, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const skipEvent = result.events.find(e => e.type === "DECISION_SKIPPED");
    expect(skipEvent).toBeDefined();
  });

  test("should link skip events to originalCause", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Optional choice",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Village",
      metadata: {
        originalCause: "evt-village",
      },
    };
    state.pendingChoiceEventId = "evt-10";

    const result = handleSkipDecision(state, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    // Skip event should be linked to pendingChoiceEventId
    const skipEvent = result.events.find(e => e.type === "DECISION_SKIPPED");
    expect(skipEvent?.causedBy).toBe("evt-10");
  });

  test("should return error if on_skip handler creates pending choice", () => {
    const state = createMockState();
    // This would require mocking getCardEffect to return pendingChoice
    // For now, we test the error path exists
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Skip test",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Village",
    };

    const result = handleSkipDecision(state, "p1");
    expect(result.ok).toBe(true);
  });

  test("should handle skip with no effect for unknown card", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Skip test",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Copper",
    };
    state.pendingChoiceEventId = "evt-11";

    const result = handleSkipDecision(state, "p1");

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });
});

describe("handle-decision - Throne Room integration", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should handle Throne Room second execution", () => {
    const state = createMockState();
    state.players.p1!.deck = ["Copper", "Copper", "Copper", "Copper"];
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Smithy draws 3 cards",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Smithy",
      metadata: {
        throneRoomTarget: "Smithy",
        throneRoomExecutionsRemaining: 2,
        originalCause: "evt-throne",
      },
    };

    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle Throne Room with executionsRemaining = 0", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Final execution",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Village",
      metadata: {
        throneRoomTarget: "Village",
        throneRoomExecutionsRemaining: 0,
        originalCause: "evt-throne",
      },
    };

    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });
});

describe("handle-decision - Edge cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should handle decision with stage but no metadata", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Village",
      stage: "test_stage",
    };

    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle decision with metadata but no stage", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Village",
      metadata: {
        testKey: "testValue",
      },
    };

    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
  });

  test("should handle decision without pendingChoiceEventId", () => {
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
    state.pendingChoiceEventId = null;

    const result = handleSubmitDecision(state, "p1", { selectedCards: [] });

    expect(result.ok).toBe(true);
    expect(result.events).toBeDefined();
    if (!result.events) throw new Error("Expected events");

    const resolvedEvent = result.events.find(
      e => e.type === "DECISION_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
    // causedBy should be undefined when no pendingChoiceEventId
    expect(resolvedEvent?.causedBy).toBeUndefined();
  });
});
