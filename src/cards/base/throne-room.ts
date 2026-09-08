/**
 * Throne Room - Choose an action from hand, play it twice
 */

import { createMultiStageCard } from "../effect-types";
import { isActionCard } from "../../data/cards";
import { STAGES } from "../stages";

export const throneRoom = createMultiStageCard({
  initial: ({ state, playerId }) => {
    const playerState = state.players[playerId];
    if (!playerState) return { events: [] };

    const actions = playerState.hand.filter(isActionCard);
    if (actions.length === 0) return { events: [] };

    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "hand",
        prompt: "Throne Room: Choose an Action to play twice",
        cardOptions: actions,
        min: 0,
        max: 1,
        cardBeingPlayed: "Throne Room",
        stage: STAGES.CHOOSE_ACTION,
      },
    };
  },

  choose_action: ({ playerId, decision }) => {
    const card = decision?.selectedCards[0];
    return {
      events: [],
      operations: card
        ? [{ type: "play", playerId, card, from: "hand", times: 2 }]
        : [],
    };
  },
});
