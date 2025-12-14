/**
 * Remodel - Trash a card from hand, gain a card costing up to $2 more
 */

import { createMultiStageCard, getGainableCards } from "../effect-types";
import { CARDS } from "../../data/cards";
import { STAGES } from "../stages";

const COST_BONUS = 2;

export const remodel = createMultiStageCard({
  initial: ({ state, player }) => {
    const playerState = state.players[player];
    if (playerState.hand.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "hand",
        prompt: "Remodel: Choose a card to trash",
        cardOptions: [...playerState.hand],
        min: 1,
        max: 1,
        cardBeingPlayed: "Remodel",
        stage: STAGES.TRASH,
      },
    };
  },

  trash: ({ state, player, decision }) => {
    if (!decision) return { events: [] };
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const trashCost = CARDS[toTrash].cost;
    const maxCost = trashCost + COST_BONUS;
    const gainOptions = getGainableCards(state, maxCost);

    const events = [
      {
        type: "CARD_TRASHED" as const,
        player,
        card: toTrash,
        from: "hand" as const,
      },
    ];

    if (gainOptions.length === 0) return { events };

    return {
      events,
      pendingDecision: {
        type: "card_decision",
        player,
        from: "supply",
        prompt: `Remodel: Gain a card costing up to $${maxCost}`,
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Remodel",
        stage: STAGES.GAIN,
        metadata: { trashedCard: toTrash, maxCost },
      },
    };
  },

  gain: ({ player, decision }) => {
    if (!decision) return { events: [] };
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "discard" }],
    };
  },
});
