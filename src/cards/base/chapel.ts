/**
 * Chapel - Trash up to 4 cards from your hand (one at a time)
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

  // Initial call: start trashing loop
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
        prompt: "Chapel: Trash a card from your hand (or skip)",
        cardOptions: [...playerState.hand],
        min: 0,
        max: 1,
        canSkip: true,
        cardBeingPlayed: "Chapel",
        stage: "trash",
        metadata: { trashedCount: 0 },
      },
    };
  }

  // Process trash decision
  if (stage === "trash" && decision) {
    const toTrash = decision.selectedCards[0];
    const trashedCount =
      (state.pendingDecision?.metadata?.trashedCount as number) || 0;

    // Player skipped - done
    if (!toTrash) {
      return { events: [] };
    }

    const trashEvent = {
      type: "CARD_TRASHED" as const,
      player,
      card: toTrash,
      from: "hand" as const,
    };

    const newTrashedCount = trashedCount + 1;

    // Check if we should continue (not at limit and still have cards)
    // Use removeCards to remove only ONE instance (not all copies)
    const updatedHand = removeCards(playerState.hand, [toTrash]);
    const shouldContinue =
      newTrashedCount < CHAPEL_MAX_TRASH && updatedHand.length > 0;

    if (!shouldContinue) {
      return { events: [trashEvent] };
    }

    // Continue trashing - create next decision
    return {
      events: [trashEvent],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "hand",
        prompt: `Chapel: Trash another card (${newTrashedCount}/${CHAPEL_MAX_TRASH} trashed, or skip)`,
        cardOptions: updatedHand,
        min: 0,
        max: 1,
        canSkip: true,
        cardBeingPlayed: "Chapel",
        stage: "trash",
        metadata: { trashedCount: newTrashedCount },
      },
    };
  }

  return { events: [] };
};
