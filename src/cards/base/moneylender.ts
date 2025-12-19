/**
 * Moneylender - Trash a Copper from your hand for +$3
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { STAGES } from "../stages";

export const moneylender: CardEffect = ({
  state,
  playerId,
  decision,
}): CardEffectResult => {
  const playerState = state.players[playerId];
  if (!playerState) return { events: [] };

  const hasCopperInHand = playerState.hand.includes("Copper");

  if (!hasCopperInHand) return { events: [] };

  // Request confirmation (or auto-trash for AI)
  if (!decision) {
    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "hand",
        prompt: "Moneylender: Trash a Copper for +$3?",
        cardOptions: ["Copper"],
        min: 0,
        max: 1,
        cardBeingPlayed: "Moneylender",
        stage: STAGES.TRASH,
      },
    };
  }

  // Execute trash + coins
  if (decision.selectedCards.includes("Copper")) {
    return {
      events: [
        { type: "CARD_TRASHED", playerId, card: "Copper", from: "hand" },
        { type: "COINS_MODIFIED", delta: 3 },
      ],
    };
  }

  return { events: [] };
};
