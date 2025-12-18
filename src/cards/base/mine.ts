/**
 * Mine - Trash a Treasure from hand, gain a Treasure costing up to $3 more to hand
 */

import {
  createMultiStageCard,
  generateDecisionFromSpec,
} from "../effect-types";
import { CARDS } from "../../data/cards";
import { STAGES } from "../stages";

export const mine = createMultiStageCard({
  initial: ({ state, playerId }) => {
    const playerState = state.players[playerId]!;
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
      pendingChoice: generateDecisionFromSpec({
        spec: trashSpec,
        card: "Mine",
        playerId,
        state,
        stage: STAGES.TRASH,
      }),
    };
  },

  trash: ({ state, playerId, decision }) => {
    if (!decision) return { events: [] };
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const events = [
      {
        type: "CARD_TRASHED" as const,
        playerId,
        card: toTrash,
        from: "hand" as const,
      },
    ];

    const cardDef = CARDS.Mine;
    const gainSpec = cardDef.decisions?.gain;
    if (!gainSpec) return { events };

    // Store the trashed card in a temporary state for gain decision
    if (!state.pendingChoice) return { events };

    const stateWithMetadata = {
      ...state,
      pendingChoice: {
        ...state.pendingChoice,
        metadata: { trashedCard: toTrash },
      },
    };

    const gainDecision = generateDecisionFromSpec({
      spec: gainSpec,
      card: "Mine",
      playerId,
      state: stateWithMetadata,
      stage: STAGES.GAIN,
    });

    // Check if there are any options
    if (gainDecision.cardOptions.length === 0) return { events };

    return {
      events,
      pendingChoice: gainDecision,
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
