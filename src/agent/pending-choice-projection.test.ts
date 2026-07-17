import { describe, it, expect } from "bun:test";
import { projectPendingChoiceForAI } from "./pending-choice-projection";
import type { PendingChoice } from "../types/pending-choice";

function decision(
  overrides: Partial<Extract<PendingChoice, { choiceType: "decision" }>> = {},
): PendingChoice {
  return {
    choiceType: "decision",
    playerId: "player_0",
    prompt: "Choose a card to trash",
    cardOptions: ["Copper", "Estate"],
    cardBeingPlayed: "Chapel",
    ...overrides,
  };
}

describe("projectPendingChoiceForAI", () => {
  it("keeps decision essentials and drops UI/internal fields", () => {
    const projected = projectPendingChoiceForAI(
      decision({
        stage: "trash",
        actions: [
          { id: "trash_card", label: "Trash", color: "#ef4444" },
          { id: "skip", label: "Skip", color: "#94a3b8", isDefault: true },
        ],
        metadata: { internal: true },
      }),
    );

    expect(projected).toMatchObject({
      choiceType: "decision",
      prompt: "Choose a card to trash",
      cardBeingPlayed: "Chapel",
      options: ["Copper", "Estate"],
    });
    expect(projected).not.toHaveProperty("actions");
    expect(projected).not.toHaveProperty("metadata");
    expect(projected).not.toHaveProperty("stage");
    expect(JSON.stringify(projected)).not.toContain("#ef4444");
  });

  it("describes an exact-count constraint", () => {
    const projected = projectPendingChoiceForAI(decision({ min: 2, max: 2 }));

    expect(projected.constraint).toBe("select exactly 2 cards");
  });

  it("defaults missing min/max to exactly 1", () => {
    const projected = projectPendingChoiceForAI(decision());

    expect(projected.constraint).toBe("select exactly 1 card");
  });

  it("describes an optional constraint with skip allowed", () => {
    const projected = projectPendingChoiceForAI(decision({ min: 0, max: 4 }));

    expect(projected.constraint).toBe(
      "select up to 4 cards (skipping is allowed)",
    );
  });

  it("describes a ranged constraint", () => {
    const projected = projectPendingChoiceForAI(decision({ min: 1, max: 3 }));

    expect(projected.constraint).toBe("select between 1 and 3 cards");
  });

  it("includes the source zone when present", () => {
    const projected = projectPendingChoiceForAI(decision({ from: "supply" }));

    expect(projected.source).toBe("supply");
  });

  it("surfaces the current card for multi-round decisions", () => {
    const projected = projectPendingChoiceForAI(
      decision({
        cardOptions: ["Copper", "Gold"],
        metadata: { currentRoundIndex: 1 },
      }),
    );

    expect(projected.deciding).toBe("Gold");
    expect(projected.progress).toBe("card 2 of 2");
  });

  it("includes the ordering prompt when present", () => {
    const projected = projectPendingChoiceForAI(
      decision({ orderingPrompt: "Choose order to put back" }),
    );

    expect(projected.orderingPrompt).toBe("Choose order to put back");
  });

  it("projects reactions to their trigger and available reactions", () => {
    const projected = projectPendingChoiceForAI({
      choiceType: "reaction",
      playerId: "player_1",
      triggeringPlayerId: "player_0",
      triggeringCard: "Militia",
      triggerType: "on_attack",
      availableReactions: ["Moat"],
      metadata: {
        allTargets: ["player_1"],
        currentTargetIndex: 0,
        blockedTargets: [],
        originalCause: "evt_1",
      },
    });

    expect(projected).toEqual({
      choiceType: "reaction",
      reactionTo: "Militia",
      trigger: "on_attack",
      availableReactions: ["Moat"],
    });
  });
});
