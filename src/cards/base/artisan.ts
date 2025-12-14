/**
 * Artisan - Gain a card costing up to $5 to your hand, put a card from hand onto your deck
 */

import { createMultiStageCard, getGainableCards } from "../effect-types";
import { STAGES } from "../stages";

const MAX_GAIN_COST = 5;

export const artisan = createMultiStageCard({
  initial: ({ state, player }) => {
    const gainOptions = getGainableCards(state, MAX_GAIN_COST);
    if (gainOptions.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "supply",
        prompt: "Artisan: Gain a card costing up to $5 to your hand",
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Artisan",
        stage: STAGES.GAIN,
      },
    };
  },

  gain: ({ state, player, decision }) => {
    if (!decision) return { events: [] };
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    const playerState = state.players[player];
    const handAfterGain = [...playerState.hand, gained];

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "hand" }],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "hand",
        prompt: "Artisan: Put a card from your hand onto your deck",
        cardOptions: handAfterGain,
        min: 1,
        max: 1,
        cardBeingPlayed: "Artisan",
        stage: STAGES.TOPDECK,
      },
    };
  },

  topdeck: ({ player, decision }) => {
    if (!decision) return { events: [] };
    const toPutOnDeck = decision.selectedCards[0];
    if (!toPutOnDeck) return { events: [] };

    return {
      events: [
        { type: "CARD_PUT_ON_DECK", player, card: toPutOnDeck, from: "hand" },
      ],
    };
  },
});
