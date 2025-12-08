/**
 * Moneylender - Trash a Copper from your hand for +$3
 */

import type { CardEffect, CardEffectResult } from "../effect-types";

export const moneylender: CardEffect = ({
  state,
  player,
  decision,
}): CardEffectResult => {
  const playerState = state.players[player];
  const hasCopperInHand = playerState.hand.includes("Copper");

  if (!hasCopperInHand) return { events: [] };

  // Request confirmation (or auto-trash for AI)
  if (!decision) {
    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Moneylender: Trash a Copper for +$3?",
        cardOptions: ["Copper"],
        min: 0,
        max: 1,
        cardBeingPlayed: "Moneylender",
        stage: "trash",
      },
    };
  }

  // Execute trash + coins
  if (decision.selectedCards.includes("Copper")) {
    return {
      events: [
        { type: "CARD_TRASHED", player, card: "Copper", from: "hand" },
        { type: "COINS_MODIFIED", delta: 3 },
      ],
    };
  }

  return { events: [] };
};
