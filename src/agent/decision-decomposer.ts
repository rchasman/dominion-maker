import type { DecisionRequest } from "../types/game-state";
import type { Action } from "../types/action";

/**
 * Decompose batch decisions into atomic actions for AI consensus voting.
 * Only used for AI - humans work with batch decisions directly.
 *
 * Action IDs in decisions now match action types directly (e.g., "topdeck_card"),
 * eliminating the need for mapping layers.
 *
 * For multi-action decisions (like Sentry), returns actions for the NEXT card
 * based on currentRoundIndex in metadata.
 */
export function decomposeDecisionForAI(decision: DecisionRequest): Action[] {
  const { min, max, cardOptions, stage, actions: availableActions } = decision;

  // Decision with custom actions (like Sentry: topdeck/trash/discard per card)
  // Multi-round consensus: vote on ONE card at a time
  if (
    availableActions &&
    availableActions.length > 0 &&
    !availableActions.every(a => a.id === "select" || a.id === "skip")
  ) {
    const roundIndex = (decision.metadata?.currentRoundIndex as number) || 0;

    if (roundIndex >= cardOptions.length) {
      return [{ type: "skip_decision" as const }];
    }

    const currentCard = cardOptions[roundIndex];

    const cardActions = availableActions.map(action => ({
      type: action.id as Action["type"],
      card: currentCard,
    }));

    return [...cardActions, { type: "skip_decision" as const }];
  }

  // Multi-card decision: decompose into atomic actions
  if (max > 1) {
    const actions = cardOptions.map(card => {
      if (stage === "trash") {
        return { type: "trash_card" as const, card };
      }
      if (stage === "discard") {
        return { type: "discard_card" as const, card };
      }
      if (stage === "gain") {
        return { type: "gain_card" as const, card };
      }
      throw new Error(`Unknown batch decision stage: ${stage}`);
    });

    return min === 0 ? [...actions, { type: "skip_decision" as const }] : actions;
  }

  return [];
}
