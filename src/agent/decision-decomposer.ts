import type { PendingChoice } from "../types/game-state";
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
export function decomposeDecisionForAI(
  decision: Extract<PendingChoice, { choiceType: "decision" }>,
): Action[] {
  const { min, max, cardOptions, stage, actions: availableActions } = decision;

  // Decision with custom actions (like Sentry: topdeck/trash/discard per card)
  // Multi-round consensus: vote on ONE card at a time
  if (
    availableActions &&
    availableActions.length > 0 &&
    !availableActions.every(a => a.id === "select" || a.id === "skip")
  ) {
    const roundIndex =
      typeof decision.metadata?.currentRoundIndex === "number"
        ? decision.metadata.currentRoundIndex
        : 0;

    if (roundIndex >= cardOptions.length) {
      return [{ type: "skip_decision" as const }];
    }

    const currentCard = cardOptions[roundIndex];
    if (!currentCard) {
      return [{ type: "skip_decision" as const }];
    }

    const cardActions = availableActions.map(
      action =>
        ({
          type: action.id as Exclude<Action["type"], "choose_from_options">,
          card: currentCard,
        }) as Action,
    );

    return [...cardActions, { type: "skip_decision" as const }];
  }

  // Multi-card decision: decompose into atomic actions
  if ((max ?? 0) > 1) {
    const actions = cardOptions.map(card => {
      if (stage === "trash" || stage === "victim_trash_choice") {
        return { type: "trash_card" as const, card };
      }
      if (stage === "discard" || stage === "opponent_discard") {
        return { type: "discard_card" as const, card };
      }
      if (stage === "topdeck" || stage === "opponent_topdeck") {
        return { type: "topdeck_card" as const, card };
      }
      if (stage === "gain") {
        return { type: "gain_card" as const, card };
      }
      throw new Error(`Unknown batch decision stage: ${stage}`);
    });

    return min === 0
      ? [...actions, { type: "skip_decision" as const }]
      : actions;
  }

  return [];
}
