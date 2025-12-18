/**
 * Artisan - Gain a card costing up to $5 to your hand, put a card from hand onto your deck
 */

import { createMultiStageCard, getGainableCards } from "../effect-types";
import { STAGES } from "../stages";

const MAX_GAIN_COST = 5;

export const artisan = createMultiStageCard({
  initial: ({ state, playerId }) => {
    const gainOptions = getGainableCards(state, MAX_GAIN_COST);
    if (gainOptions.length === 0) return { events: [] };

    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
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

  gain: ({ state, playerId, decision }) => {
    if (!decision) return { events: [] };
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    const playerState = state.players[playerId];
    const handAfterGain = [...playerState.hand, gained];

    return {
      events: [{ type: "CARD_GAINED", playerId, card: gained, to: "hand" }],
      pendingChoice: {
        choiceType: "decision",
        playerId,
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

  topdeck: ({ playerId, decision }) => {
    if (!decision) return { events: [] };
    const toPutOnDeck = decision.selectedCards[0];
    if (!toPutOnDeck) return { events: [] };

    return {
      events: [
        { type: "CARD_PUT_ON_DECK", playerId, card: toPutOnDeck, from: "hand" },
      ],
    };
  },
});
