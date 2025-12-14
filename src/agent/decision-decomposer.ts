import type { DecisionRequest, GameState } from "../types/game-state";
import type { Action } from "../types/action";

/**
 * Decompose batch decisions into atomic actions for AI consensus voting.
 * Only used for AI - humans work with batch decisions directly.
 *
 * This allows MAKER consensus to vote on each individual card selection
 * while preserving the card's true semantic intent (e.g., "trash up to 4").
 */
export function decomposeDecisionForAI(
  decision: DecisionRequest,
  state: GameState,
): Action[] {
  const { min, max, cardOptions, stage } = decision;

  // Multi-card decision: decompose into atomic actions
  if (max > 1) {
    const actions: Action[] = cardOptions.map(card => {
      // Map stage to action type
      if (stage === "trash") {
        return { type: "trash_card" as const, card };
      }
      if (stage === "discard") {
        return { type: "discard_card" as const, card };
      }
      if (stage === "gain") {
        return { type: "gain_card" as const, card };
      }
      // Generic selection - use most specific available action
      return { type: "play_action" as const, card };
    });

    // Add skip option if min is 0 (skip allowed)
    if (min === 0) {
      actions.push({ type: "skip_decision" as const });
    }

    return actions;
  }

  // Single-card decision: already atomic
  // This will be handled by existing getLegalActions logic
  return [];
}
