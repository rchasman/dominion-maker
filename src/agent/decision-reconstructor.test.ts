import { describe, it, expect } from "bun:test";
import {
  simulateCardSelection,
  isBatchDecision,
  isMultiActionDecision,
} from "./decision-reconstructor";
import { DominionEngine } from "../engine";
import type { PendingChoice } from "../types/game-state";

describe("simulateCardSelection", () => {
  it("should remove selected card from decision options", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    // Set up a batch decision
    engine.state.pendingChoice = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash cards",
      min: 0,
      max: 4,
      cardOptions: ["Copper", "Copper", "Estate", "Duchy"],
      stage: "trash",
      from: "hand",
    };

    const simulated = simulateCardSelection(engine, "Copper");

    const decision = simulated.state.pendingChoice as Extract<
      PendingChoice,
      { choiceType: "decision" }
    >;
    expect(decision.cardOptions).toEqual(["Copper", "Estate", "Duchy"]);
    expect(decision.cardOptions.length).toBe(3);
  });

  it("should only remove one instance of duplicate cards", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    engine.state.pendingChoice = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash cards",
      min: 0,
      max: 4,
      cardOptions: ["Copper", "Copper", "Copper"],
      stage: "trash",
      from: "hand",
    };

    const simulated = simulateCardSelection(engine, "Copper");

    const decision = simulated.state.pendingChoice as Extract<
      PendingChoice,
      { choiceType: "decision" }
    >;
    // Should still have 2 Copper left
    expect(decision.cardOptions).toEqual(["Copper", "Copper"]);
  });

  it("should handle removing card not in options", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    engine.state.pendingChoice = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash cards",
      min: 0,
      max: 4,
      cardOptions: ["Copper", "Estate"],
      stage: "trash",
      from: "hand",
    };

    const simulated = simulateCardSelection(engine, "Gold");

    const decision = simulated.state.pendingChoice as Extract<
      PendingChoice,
      { choiceType: "decision" }
    >;
    // Options should be unchanged
    expect(decision.cardOptions).toEqual(["Copper", "Estate"]);
  });

  it("should return original engine when no pending decision", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    engine.state.pendingChoice = null;

    const simulated = simulateCardSelection(engine, "Copper");

    expect(simulated).toBe(engine);
  });

  it("should return original engine when not a decision choice", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    engine.state.pendingChoice = {
      choiceType: "reaction",
      playerId: "player1",
      prompt: "Reveal reaction?",
      availableReactions: ["Moat"],
    };

    const simulated = simulateCardSelection(engine, "Copper");

    expect(simulated).toBe(engine);
  });

  it("should handle empty cardOptions", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    engine.state.pendingChoice = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash cards",
      min: 0,
      max: 4,
      cardOptions: [],
      stage: "trash",
      from: "hand",
    };

    const simulated = simulateCardSelection(engine, "Copper");

    const decision = simulated.state.pendingChoice as Extract<
      PendingChoice,
      { choiceType: "decision" }
    >;
    expect(decision.cardOptions).toEqual([]);
  });

  it("should not mutate original engine state", () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    engine.state.pendingChoice = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash cards",
      min: 0,
      max: 4,
      cardOptions: ["Copper", "Estate"],
      stage: "trash",
      from: "hand",
    };

    const originalOptions = [...(engine.state.pendingChoice.cardOptions || [])];
    simulateCardSelection(engine, "Copper");

    // Original should be unchanged
    expect(engine.state.pendingChoice?.cardOptions).toEqual(originalOptions);
  });
});

describe("isBatchDecision", () => {
  it("should return true for batch decision with max > 1", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash up to 4 cards",
      min: 0,
      max: 4,
      cardOptions: ["Copper"],
      stage: "trash",
      from: "hand",
    };

    expect(isBatchDecision(decision)).toBe(true);
  });

  it("should return false for single card decision (max = 1)", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash a card",
      min: 0,
      max: 1,
      cardOptions: ["Copper"],
      stage: "trash",
      from: "hand",
    };

    expect(isBatchDecision(decision)).toBe(false);
  });

  it("should return false for max = undefined", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash a card",
      min: 0,
      max: undefined,
      cardOptions: ["Copper"],
      stage: "trash",
      from: "hand",
    };

    expect(isBatchDecision(decision)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isBatchDecision(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isBatchDecision()).toBe(false);
  });

  it("should return false for reaction choice", () => {
    const reaction: Extract<PendingChoice, { choiceType: "reaction" }> = {
      choiceType: "reaction",
      playerId: "player1",
      prompt: "Reveal reaction?",
      availableReactions: ["Moat"],
    };

    expect(isBatchDecision(reaction as any)).toBe(false);
  });
});

describe("isMultiActionDecision", () => {
  it("should return true for Sentry-style decision", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Choose action for each card",
      min: 0,
      max: 1,
      cardOptions: ["Copper", "Silver"],
      actions: [
        { id: "topdeck_card", label: "Topdeck", isDefault: false },
        { id: "trash_card", label: "Trash", isDefault: false },
        { id: "discard_card", label: "Discard", isDefault: true },
      ],
      stage: "topdeck",
      from: "deck",
    };

    expect(isMultiActionDecision(decision)).toBe(true);
  });

  it("should return false for decision with only select/skip actions", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Select cards",
      min: 0,
      max: 2,
      cardOptions: ["Copper"],
      actions: [
        { id: "select", label: "Select", isDefault: false },
        { id: "skip", label: "Skip", isDefault: true },
      ],
      stage: "trash",
      from: "hand",
    };

    expect(isMultiActionDecision(decision)).toBe(false);
  });

  it("should return false for decision without actions", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Trash cards",
      min: 0,
      max: 4,
      cardOptions: ["Copper"],
      stage: "trash",
      from: "hand",
    };

    expect(isMultiActionDecision(decision)).toBe(false);
  });

  it("should return false for empty actions array", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Choose cards",
      min: 0,
      max: 2,
      cardOptions: ["Copper"],
      actions: [],
      stage: "trash",
      from: "hand",
    };

    expect(isMultiActionDecision(decision)).toBe(false);
  });

  it("should return false for null", () => {
    expect(isMultiActionDecision(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isMultiActionDecision()).toBe(false);
  });

  it("should return false for reaction choice", () => {
    const reaction: Extract<PendingChoice, { choiceType: "reaction" }> = {
      choiceType: "reaction",
      playerId: "player1",
      prompt: "Reveal reaction?",
      availableReactions: ["Moat"],
    };

    expect(isMultiActionDecision(reaction as any)).toBe(false);
  });

  it("should handle actions with only skip", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Skip?",
      min: 0,
      max: 1,
      cardOptions: [],
      actions: [{ id: "skip", label: "Skip", isDefault: true }],
      stage: "trash",
      from: "hand",
    };

    expect(isMultiActionDecision(decision)).toBe(false);
  });

  it("should return true when at least one non-select/skip action exists", () => {
    const decision: Extract<PendingChoice, { choiceType: "decision" }> = {
      choiceType: "decision",
      playerId: "player1",
      prompt: "Choose action",
      min: 0,
      max: 1,
      cardOptions: ["Copper"],
      actions: [
        { id: "select", label: "Select", isDefault: false },
        { id: "trash_card", label: "Trash", isDefault: false },
        { id: "skip", label: "Skip", isDefault: true },
      ],
      stage: "trash",
      from: "hand",
    };

    expect(isMultiActionDecision(decision)).toBe(true);
  });
});
