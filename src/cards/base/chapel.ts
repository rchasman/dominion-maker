/**
 * Chapel - Trash up to 4 cards from your hand
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { cardsToEvents, isInitialCall } from "../effect-types";
import { STAGES } from "../stages";

const CHAPEL_MAX_TRASH = 4;

export const chapel: CardEffect = ({
  state,
  playerId,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[playerId];
  if (!playerState) return { events: [] };

  // Initial call: request batch selection
  if (isInitialCall(decision, stage)) {
    if (playerState.hand.length === 0) {
      return { events: [] };
    }

    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "hand",
        prompt: "Chapel: Trash up to 4 cards from your hand",
        cardOptions: [...playerState.hand],
        min: 0,
        max: CHAPEL_MAX_TRASH,
        cardBeingPlayed: "Chapel",
        stage: STAGES.TRASH,
      },
    };
  }

  // Process trash decision
  if (stage === STAGES.TRASH && decision) {
    const toTrash = decision.selectedCards;

    if (toTrash.length === 0) {
      return { events: [] };
    }

    const events = cardsToEvents(toTrash, playerId, "CARD_TRASHED");

    // Never create loop - just process and finish
    // AI strategy layer handles multi-round consensus before calling this
    return { events };
  }

  return { events: [] };
};
