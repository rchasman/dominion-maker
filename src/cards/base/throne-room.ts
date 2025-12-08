/**
 * Throne Room - Choose an action from hand, play it twice
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { isActionCard } from "../effect-types";

export const throneRoom: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[player];

  // Initial: Choose an action to play twice
  if (!decision || stage === undefined) {
    const actions = playerState.hand.filter(isActionCard);

    if (actions.length === 0) {
      return { events: [] };
    }

    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "hand",
        prompt: "Throne Room: Choose an Action to play twice",
        cardOptions: actions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Throne Room",
        stage: "choose_action",
      },
    };
  }

  // Store chosen card for engine to execute twice
  if (stage === "choose_action") {
    const cardToPlay = decision.selectedCards[0];

    // Don't emit CARD_PLAYED here - instead create a special decision
    // that tells the engine to execute this card twice
    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        from: "options",
        prompt: "",
        cardOptions: [],
        min: 0,
        max: 0,
        cardBeingPlayed: "Throne Room",
        stage: "execute_throned_card",
        metadata: {
          throneRoomTarget: cardToPlay,
          throneRoomExecutionsRemaining: 2,
        },
      },
    };
  }

  return { events: [] };
};
