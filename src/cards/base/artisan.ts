/**
 * Artisan - Gain a card costing up to $5 to your hand, put a card from hand onto your deck
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getGainableCards } from "../effect-types";

export const artisan: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[player];

  // Stage 1: Choose card to gain
  if (!decision || stage === undefined) {
    const gainOptions = getGainableCards(state, 5);
    if (gainOptions.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "supply",
        prompt: "Artisan: Gain a card costing up to $5 to your hand",
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Artisan",
        stage: "gain",
      },
    };
  }

  // Stage 2: Gain to hand, then choose card to put on deck
  if (stage === "gain") {
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    // Gain to hand, then must put a card from hand on deck
    // Note: hand now includes the gained card
    const handAfterGain = [...playerState.hand, gained];

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "hand" }],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Artisan: Put a card from your hand onto your deck",
        cardOptions: handAfterGain,
        min: 1,
        max: 1,
        cardBeingPlayed: "Artisan",
        stage: "topdeck",
      },
    };
  }

  // Stage 3: Put card on deck
  if (stage === "topdeck") {
    const toPutOnDeck = decision.selectedCards[0];
    if (!toPutOnDeck) return { events: [] };

    return {
      events: [
        { type: "CARD_PUT_ON_DECK", player, card: toPutOnDeck, from: "hand" },
      ],
    };
  }

  return { events: [] };
};
