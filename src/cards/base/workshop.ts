/**
 * Workshop - Gain a card costing up to $4
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getGainableCards } from "../effect-types";
import { STAGES } from "../stages";

const MAX_GAIN_COST = 4;

export const workshop: CardEffect = ({
  state,
  playerId,
  decision,
}): CardEffectResult => {
  // Stage 1: Request gain choice
  if (!decision) {
    const gainOptions = getGainableCards(state, MAX_GAIN_COST);
    if (gainOptions.length === 0) return { events: [] };

    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "supply",
        prompt: "Workshop: Gain a card costing up to $4",
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Workshop",
        stage: STAGES.GAIN,
      },
    };
  }

  // Stage 2: Execute gain
  const gained = decision.selectedCards[0];
  if (!gained) return { events: [] };

  return {
    events: [{ type: "CARD_GAINED", playerId, card: gained, to: "discard" }],
  };
};
