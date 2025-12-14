/**
 * Chapel - Trash up to 4 cards from your hand
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { isInitialCall } from "../effect-types";

const CHAPEL_MAX_TRASH = 4;

export const chapel: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[player];

  // Initial call: request batch selection
  if (isInitialCall(decision, stage)) {
    if (playerState.hand.length === 0) {
      return { events: [] };
    }

    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "hand",
        prompt: "Chapel: Trash up to 4 cards from your hand",
        cardOptions: [...playerState.hand],
        min: 0,
        max: CHAPEL_MAX_TRASH,
        cardBeingPlayed: "Chapel",
        stage: "trash",
      },
    };
  }

  // Process trash decision
  if (stage === "trash" && decision) {
    const toTrash = decision.selectedCards;

    if (toTrash.length === 0) {
      return { events: [] };
    }

    // Emit one event per card (preserves atomicity)
    const events = toTrash.map(card => ({
      type: "CARD_TRASHED" as const,
      player,
      card,
      from: "hand" as const,
    }));

    // Never create loop - just process and finish
    // AI strategy layer handles multi-round consensus before calling this
    return { events };
  }

  return { events: [] };
};
