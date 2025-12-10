/**
 * Chapel - Trash up to 4 cards from your hand
 */

import { createMultiStageCard, generateDecisionFromSpec } from "../effect-types";
import { CARDS } from "../../data/cards";

export const chapel = createMultiStageCard({
  initial: ({ state, player }) => {
    const playerState = state.players[player];
    if (playerState.hand.length === 0) return { events: [] };

    const cardDef = CARDS.Chapel;
    const trashSpec = cardDef.decisions?.trash;
    if (!trashSpec) {
      return { events: [] };
    }

    return {
      events: [],
      pendingDecision: generateDecisionFromSpec({
        spec: trashSpec,
        card: "Chapel",
        player,
        state,
        stage: "trash",
      }),
    };
  },

  trash: ({ player, decision }) => {
    if (!decision) return { events: [] };
    const toTrash = decision.selectedCards;
    if (toTrash.length === 0) return { events: [] };

    const events = toTrash.map(card => ({
      type: "CARD_TRASHED" as const,
      player,
      card,
      from: "hand" as const,
    }));

    return { events };
  },
});
