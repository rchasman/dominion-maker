/**
 * Mine - Trash a Treasure from hand, gain a Treasure costing up to $3 more to hand
 */

import { createMultiStageCard, getGainableTreasures } from "../effect-types";
import { CARDS, isTreasureCard } from "../../data/cards";
import { STAGES } from "../stages";

const COST_BONUS = 3;

export const mine = createMultiStageCard({
  initial: ({ state, playerId }) => {
    const playerState = state.players[playerId];
    if (!playerState) return { events: [] };

    const treasures = playerState.hand.filter(isTreasureCard);
    if (treasures.length === 0) return { events: [] };

    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "hand",
        prompt: "Mine: Trash a Treasure from your hand",
        cardOptions: treasures,
        min: 1,
        max: 1,
        cardBeingPlayed: "Mine",
        stage: STAGES.TRASH,
      },
    };
  },

  trash: ({ state, playerId, decision }) => {
    if (!decision) return { events: [] };
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const maxCost = CARDS[toTrash].cost + COST_BONUS;
    const gainOptions = getGainableTreasures(state, maxCost);

    const events = [
      {
        type: "CARD_TRASHED" as const,
        playerId,
        card: toTrash,
        from: "hand" as const,
      },
    ];

    if (gainOptions.length === 0) return { events };

    return {
      events,
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "supply",
        prompt: `Mine: Gain a Treasure costing up to $${maxCost} to your hand`,
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Mine",
        stage: STAGES.GAIN,
      },
    };
  },

  gain: ({ playerId, decision }) => {
    if (!decision) return { events: [] };
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    return {
      events: [{ type: "CARD_GAINED", playerId, card: gained, to: "hand" }],
    };
  },
});
