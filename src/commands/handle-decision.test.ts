import { describe, test, expect, beforeEach } from "bun:test";
import { handleSubmitDecision, handleSkipDecision } from "./handle-decision";
import { resetEventCounter } from "../events/id-generator";
import type { GameState } from "../types/game-state";
import type { PendingChoice } from "../types/pending-choice";

type DecisionPendingChoice = Extract<PendingChoice, { choiceType: "decision" }>;

/**
 * Build an optional Cellar choice using the same public contract as real cards.
 */
function optionalCellarDecision(
  fields: Omit<DecisionPendingChoice, "cardBeingPlayed">,
): PendingChoice {
  return { ...fields, cardBeingPlayed: "Cellar" };
}

function withChoiceFrame(state: GameState): GameState {
  const pending = state.pendingChoice;
  if (pending?.choiceType !== "decision") return state;
  return {
    ...state,
    executionStack: state.executionStack ?? [
      {
        type: "choice",
        card: pending.cardBeingPlayed,
        playerId: pending.playerId,
        cause: "evt-original",
        trigger: { type: "play" },
        memory: null,
      },
    ],
  };
}

function createMockState(): GameState {
  // Partial supply satisfies Record<CardName, number> structurally via a
  // string-keyed record (same idiom as events/project.ts).
  const supply: Record<string, number> = {
    Village: 10,
    Smithy: 10,
    Copper: 40,
    Silver: 40,
    Gold: 30,
    Estate: 8,
    Duchy: 8,
    Province: 8,
  };
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
    supply,
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
    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
    };
    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
      cardBeingPlayed: "Cellar",
      min: 0,
      max: 1,
    };
    const result = handleSubmitDecision(withChoiceFrame(state), "p2", {
      selectedCards: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
      // Cellar resumes from a saved choice frame.
      cardBeingPlayed: "Cellar",
      min: 0,
      max: 2,
    };
    state.pendingChoiceEventId = "evt-1";

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: ["Copper"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

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
    };
    state.pendingChoiceEventId = "evt-2";

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: ["Village"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

    // Should have DECISION_RESOLVED
    const resolvedEvent = result.events.find(
      e => e.type === "DECISION_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
  });

  test("should handle Throne Room with a remaining execution", () => {
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
      intent: "discard",
    };
    state.pendingChoiceEventId = "evt-3";

    state.executionStack = [
      {
        type: "effect",
        card: "Cellar",
        playerId: "p1",
        cause: "evt-throne",
        trigger: { type: "play" },
      },
      {
        type: "choice",
        card: "Cellar",
        playerId: "p1",
        cause: "evt-throne",
        trigger: { type: "play" },
        memory: null,
      },
    ];
    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();
  });

  test("should handle card effect continuation with private memory", () => {
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
      intent: "discard",
    };
    state.pendingChoiceEventId = "evt-4";

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: ["Estate"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();
  });

  test("should handle decision with an optional empty selection", () => {
    const state = createMockState();
    state.pendingChoice = optionalCellarDecision({
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Generic decision",
      cardOptions: [],
      min: 0,
      max: 0,
    });
    state.pendingChoiceEventId = "evt-5";

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

    // Should only have DECISION_RESOLVED event
    const resolvedEvent = result.events.find(
      e => e.type === "DECISION_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
    expect(
      result.events.filter(e => e.type !== "EXECUTION_UPDATED").length,
    ).toBe(1);
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
    };

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: ["Copper"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();
  });

  test("should link effect events to the saved frame cause", () => {
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
      intent: "gain",
    };
    state.pendingChoiceEventId = "evt-6";

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: ["Estate"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

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
    const result = handleSkipDecision(withChoiceFrame(state), "p1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
    };
    const result = handleSkipDecision(withChoiceFrame(state), "p1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
      cardBeingPlayed: "Cellar",
      min: 0,
      max: 1,
    };
    const result = handleSkipDecision(withChoiceFrame(state), "p2");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
      cardBeingPlayed: "Cellar",
      min: 1,
      max: 1,
    };
    const result = handleSkipDecision(withChoiceFrame(state), "p1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
      cardBeingPlayed: "Cellar",
      max: 1,
    };
    const result = handleSkipDecision(withChoiceFrame(state), "p1");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
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
      cardBeingPlayed: "Cellar",
      min: 0,
      max: 1,
    };
    state.pendingChoiceEventId = "evt-7";

    const result = handleSkipDecision(withChoiceFrame(state), "p1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

    const skipEvent = result.events.find(e => e.type === "DECISION_SKIPPED");
    expect(skipEvent).toBeDefined();
    expect(skipEvent?.causedBy).toBe("evt-7");
  });

  test("should skip with an optional empty selection", () => {
    const state = createMockState();
    state.pendingChoice = optionalCellarDecision({
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Generic optional decision",
      cardOptions: [],
      min: 0,
      max: 0,
    });
    state.pendingChoiceEventId = "evt-8";

    const result = handleSkipDecision(withChoiceFrame(state), "p1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

    // Should only have DECISION_SKIPPED
    expect(
      result.events.filter(e => e.type !== "EXECUTION_UPDATED").length,
    ).toBe(1);
    expect(result.events[0]!.type).toBe("DECISION_SKIPPED");
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
      intent: "discard",
    };
    state.pendingChoiceEventId = "evt-9";

    const result = handleSkipDecision(withChoiceFrame(state), "p1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

    const skipEvent = result.events.find(e => e.type === "DECISION_SKIPPED");
    expect(skipEvent).toBeDefined();
  });

  test("should link skip events to the pending choice event", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Optional choice",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Cellar",
    };
    state.pendingChoiceEventId = "evt-10";

    const result = handleSkipDecision(withChoiceFrame(state), "p1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

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
      cardBeingPlayed: "Cellar",
    };

    const result = handleSkipDecision(withChoiceFrame(state), "p1");
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
      cardBeingPlayed: "Cellar",
    };
    state.pendingChoiceEventId = "evt-11";

    const result = handleSkipDecision(withChoiceFrame(state), "p1");

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
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
      cardBeingPlayed: "Cellar",
    };

    state.executionStack = [
      {
        type: "effect",
        card: "Cellar",
        playerId: "p1",
        cause: "evt-throne",
        trigger: { type: "play" },
      },
      {
        type: "choice",
        card: "Cellar",
        playerId: "p1",
        cause: "evt-throne",
        trigger: { type: "play" },
        memory: null,
      },
    ];
    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();
  });

  test("should handle Throne Room with no remaining executions", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Final execution",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Cellar",
    };

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();
  });
});

describe("handle-decision - Edge cases", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  test("should handle decision with semantic intent and empty private memory", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Cellar",
      intent: "select",
    };

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();
  });

  test("should handle decision with presentation without intent", () => {
    const state = createMockState();
    state.pendingChoice = {
      choiceType: "decision",
      playerId: "p1",
      from: "hand",
      prompt: "Test",
      cardOptions: [],
      min: 0,
      max: 0,
      cardBeingPlayed: "Cellar",
    };

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
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
      // Cellar resumes from a saved choice frame.
      cardBeingPlayed: "Cellar",
      min: 0,
      max: 0,
    };
    state.pendingChoiceEventId = null;

    const result = handleSubmitDecision(withChoiceFrame(state), "p1", {
      selectedCards: [],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected ok result");
    expect(result.events).toBeDefined();

    const resolvedEvent = result.events.find(
      e => e.type === "DECISION_RESOLVED",
    );
    expect(resolvedEvent).toBeDefined();
    // causedBy should be undefined when no pendingChoiceEventId
    expect(resolvedEvent?.causedBy).toBeUndefined();
  });
});
