/**
 * Workshop - Gain a card costing up to $4
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getGainableCards } from "../effect-types";

const MAX_GAIN_COST = 4;

export const workshop: CardEffect = ({
  state,
  player,
  decision,
}): CardEffectResult => {
  // Stage 1: Request gain choice
  if (!decision) {
    const gainOptions = getGainableCards(state, MAX_GAIN_COST);
    if (gainOptions.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "supply",
        prompt: "Workshop: Gain a card costing up to $4",
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Workshop",
        stage: "gain",
      },
    };
  }

  // Stage 2: Execute gain
  const gained = decision.selectedCards[0];
  if (!gained) return { events: [] };

  return {
    events: [{ type: "CARD_GAINED", player, card: gained, to: "discard" }],
  };
};
