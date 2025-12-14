/**
 * Chapel - Trash up to 4 cards from your hand
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { isInitialCall } from "../effect-types";
import { removeCards } from "../../lib/card-array-utils";

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
        metadata: { trashedCount: 0 },
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

    // Track total trashed across all submissions
    const previousTotal =
      (state.pendingDecision?.metadata?.trashedCount as number) || 0;
    const totalTrashed = previousTotal + toTrash.length;

    // Check if we should continue asking (for atomic AI submissions)
    // If only 1 card selected and still under max, offer another decision
    const updatedHand = toTrash.reduce(
      (hand, card) => removeCards(hand, [card]),
      playerState.hand,
    );

    const shouldContinue =
      toTrash.length === 1 &&
      totalTrashed < CHAPEL_MAX_TRASH &&
      updatedHand.length > 0;

    if (shouldContinue) {
      return {
        events,
        pendingDecision: {
          type: "card_decision",
          player,
          from: "hand",
          prompt: `Chapel: Trash up to ${CHAPEL_MAX_TRASH - totalTrashed} more cards`,
          cardOptions: updatedHand,
          min: 0,
          max: CHAPEL_MAX_TRASH - totalTrashed,
          cardBeingPlayed: "Chapel",
          stage: "trash",
          metadata: { trashedCount: totalTrashed },
        },
      };
    }

    return { events };
  }

  return { events: [] };
};
