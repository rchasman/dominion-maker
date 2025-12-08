/**
 * Throne Room - Choose an action from hand, play it twice
 * TODO: Full implementation requires engine support for replaying card effects
 * Currently only works with simple cards (no decisions)
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

  // Play the chosen card (engine will need to handle double execution)
  if (stage === "choose_action") {
    const cardToPlay = decision.selectedCards[0];
    // Emit CARD_PLAYED event - full implementation needs engine support
    events.push({ type: "CARD_PLAYED", player, card: cardToPlay });
    return { events };
  }

  return { events: [] };
};
