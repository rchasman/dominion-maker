/**
 * Throne Room - Choose an action from hand, play it twice
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { isActionCard } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const throneRoom: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial: Choose an action to play twice
  if (!decision || stage === undefined) {
    const actions = playerState.hand.filter(isActionCard);

    if (actions.length === 0) {
      return { events: [] };
    }

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Throne Room: Choose an Action to play twice",
        cardOptions: actions,
        min: 0,
        max: 1,
        cardBeingPlayed: "Throne Room",
        stage: "choose_action",
      },
    };
  }

  // Play the action twice
  if (stage === "choose_action") {
    if (decision.selectedCards.length === 0) {
      return { events: [] };
    }

    const cardToPlay = decision.selectedCards[0];
    // Note: The engine handles actually playing the card twice
    // We emit a marker event
    events.push({ type: "CARD_PLAYED", player, card: cardToPlay });

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "options",
        prompt: `Throne Room: Playing ${cardToPlay} (first time)`,
        cardOptions: [],
        min: 0,
        max: 0,
        cardBeingPlayed: "Throne Room",
        stage: "execute_first",
        metadata: { throneRoomTarget: cardToPlay },
      },
    };
  }

  return { events: [] };
};
