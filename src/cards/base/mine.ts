/**
 * Mine - Trash a Treasure from hand, gain a Treasure costing up to $3 more to hand
 */

import {
  createMultiStageCard,
  generateDecisionFromSpec,
} from "../effect-types";
import { CARDS } from "../../data/cards";

export const mine = createMultiStageCard({
  initial: ({ state, player }) => {
    const playerState = state.players[player];
    const cardDef = CARDS.Mine;
    const trashSpec = cardDef.decisions?.trash;

    if (!trashSpec) return { events: [] };

    // Check if player has treasures
    const treasures = playerState.hand.filter(c =>
      CARDS[c].types.includes("treasure"),
    );
    if (treasures.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: generateDecisionFromSpec({
        spec: trashSpec,
        card: "Mine",
        player,
        state,
        stage: "trash",
      }),
    };
  },

  trash: ({ state, player, decision }) => {
    if (!decision) return { events: [] };
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const events = [
      {
        type: "CARD_TRASHED" as const,
        player,
        card: toTrash,
        from: "hand" as const,
      },
    ];

    const cardDef = CARDS.Mine;
    const gainSpec = cardDef.decisions?.gain;
    if (!gainSpec) return { events };

    // Store the trashed card in a temporary state for gain decision
    if (!state.pendingDecision) return { events };

    const stateWithMetadata = {
      ...state,
      pendingDecision: {
        ...state.pendingDecision,
        metadata: { trashedCard: toTrash },
      },
    };

    const gainDecision = generateDecisionFromSpec({
      spec: gainSpec,
      card: "Mine",
      player,
      state: stateWithMetadata,
      stage: "gain",
    });

    // Check if there are any options
    if (gainDecision.cardOptions.length === 0) return { events };

    return {
      events,
      pendingDecision: gainDecision,
    };
  },

  gain: ({ player, decision }) => {
    if (!decision) return { events: [] };
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "hand" }],
    };
  },
});
