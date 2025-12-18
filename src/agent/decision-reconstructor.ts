import type { DominionEngine } from "../engine/engine";
import type { CardName, PendingChoice } from "../types/game-state";
import { isDecisionChoice } from "../types/pending-choice";

/**
 * Helper functions for multi-round consensus decision reconstruction.
 * Batch reconstruction (Chapel/Cellar) is implemented inline in game-agent.ts.
 * Multi-action reconstruction (Sentry/Library) uses reconstructMultiActionDecision.
 */

/**
 * Simulate a card selection without emitting events.
 * Used to provide context for multi-round consensus voting.
 *
 * This creates a temporary engine state with the selected card removed,
 * allowing the next consensus round to see "what if I already selected this card".
 */
export function simulateCardSelection(
  engine: DominionEngine,
  card: CardName,
): DominionEngine {
  const state = { ...engine.state };
  const decision = state.pendingChoice;

  if (!isDecisionChoice(decision)) return engine;

  // Remove only ONE instance of the card (not all duplicates)
  const idx = decision.cardOptions.indexOf(card);
  const updatedOptions =
    idx === -1
      ? decision.cardOptions
      : [
          ...decision.cardOptions.slice(0, idx),
          ...decision.cardOptions.slice(idx + 1),
        ];

  return {
    ...engine,
    state: {
      ...state,
      pendingChoice: {
        ...decision,
        cardOptions: updatedOptions,
      },
    },
  };
}

/**
 * Check if a decision is batch-capable (requires reconstruction).
 */
export function isBatchDecision(
  decision: PendingChoice | null | undefined,
): decision is Extract<PendingChoice, { choiceType: "decision" }> {
  return isDecisionChoice(decision) && decision.max > 1;
}

/**
 * Check if a decision has custom actions per card (like Sentry).
 * These require multi-round consensus where AI votes on each card individually.
 */
export function isMultiActionDecision(
  decision: PendingChoice | null | undefined,
): decision is Extract<PendingChoice, { choiceType: "decision" }> {
  return (
    isDecisionChoice(decision) &&
    !!decision.actions &&
    decision.actions.length > 0 &&
    !decision.actions.every(a => a.id === "select" || a.id === "skip")
  );
}
