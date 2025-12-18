/**
 * Throne Room - Choose an action from hand, play it twice
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { isActionCard } from "../effect-types";
import { STAGES } from "../stages";

export const throneRoom: CardEffect = ({
  state,
  playerId,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[playerId];

  // Initial: Choose an action to play twice
  if (!decision || stage === undefined) {
    const actions = playerState.hand.filter(isActionCard);

    if (actions.length === 0) {
      return { events: [] };
    }

    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "hand",
        prompt: "Throne Room: Choose an Action to play twice",
        cardOptions: actions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Throne Room",
        stage: STAGES.CHOOSE_ACTION,
      },
    };
  }

  // Store chosen card for engine to execute twice
  if (stage === STAGES.CHOOSE_ACTION) {
    const cardToPlay = decision.selectedCards[0];

    // Don't emit CARD_PLAYED here - instead create a special decision
    // that tells the engine to execute this card twice
    return {
      events: [],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "options",
        prompt: "",
        cardOptions: [],
        min: 0,
        max: 0,
        cardBeingPlayed: "Throne Room",
        stage: STAGES.EXECUTE_THRONED_CARD,
        metadata: {
          throneRoomTarget: cardToPlay,
          throneRoomExecutionsRemaining: 2,
        },
      },
    };
  }

  return { events: [] };
};
