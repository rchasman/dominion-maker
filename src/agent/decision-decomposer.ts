import type { DecisionRequest, GameState } from "../types/game-state";
import type { Action } from "../types/action";

/**
 * Decompose batch decisions into atomic actions for AI consensus voting.
 * Only used for AI - humans work with batch decisions directly.
 *
 * This allows MAKER consensus to vote on each individual card selection
 * while preserving the card's true semantic intent (e.g., "trash up to 4").
 *
 * For multi-action decisions (like Sentry), this returns actions for the NEXT card
 * to be decided on, based on already-made decisions in metadata.
 */
export function decomposeDecisionForAI(
  decision: DecisionRequest,
  state: GameState,
): Action[] {
  const { min, max, cardOptions, stage, actions: availableActions } = decision;

  // Decision with custom actions (like Sentry: topdeck/trash/discard per card)
  // Multi-round consensus: vote on ONE card at a time
  if (
    availableActions &&
    availableActions.length > 0 &&
    !availableActions.every(a => a.id === "select" || a.id === "skip")
  ) {
    const result: Action[] = [];

    // Check metadata for already-made decisions
    const roundIndex = (decision.metadata?.currentRoundIndex as number) || 0;

    if (roundIndex >= cardOptions.length) {
      // All cards decided, should not reach here
      return [{ type: "skip_decision" as const }];
    }

    // Create actions for the current card
    const currentCard = cardOptions[roundIndex];

    availableActions.forEach(action => {
      if (action.id === "trash") {
        result.push({ type: "trash_card" as const, card: currentCard });
      } else if (action.id === "discard") {
        result.push({ type: "discard_card" as const, card: currentCard });
      } else if (action.id === "topdeck") {
        result.push({ type: "topdeck_card" as const, card: currentCard });
      } else if (action.id === "set_aside") {
        // Library: set aside action cards
        result.push({ type: "discard_card" as const, card: currentCard });
      } else if (action.id === "draw") {
        // Library: draw (keep) the card - use topdeck to represent "keep"
        result.push({ type: "topdeck_card" as const, card: currentCard });
      }
    });

    // Can always skip to accept defaults for remaining cards
    result.push({ type: "skip_decision" as const });

    return result;
  }

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
