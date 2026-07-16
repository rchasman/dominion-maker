/**
 * Moneylender - Trash a Copper from your hand for +$3
 */

import { createMultiStageCard } from "../effect-types";
import { STAGES } from "../stages";

export const moneylender = createMultiStageCard({
  initial: ({ state, playerId }) => {
    const playerState = state.players[playerId];
    if (!playerState) return { events: [] };
    if (!playerState.hand.includes("Copper")) return { events: [] };

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
  },

  trash: ({ playerId, decision }) => {
    if (!decision?.selectedCards.includes("Copper")) return { events: [] };

    return {
      events: [
        { type: "CARD_TRASHED", playerId, card: "Copper", from: "hand" },
        { type: "COINS_MODIFIED", delta: 3 },
      ],
    };
  },
});
