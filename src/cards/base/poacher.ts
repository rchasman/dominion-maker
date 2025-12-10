/**
 * Poacher - +1 Card, +1 Action, +$1. Discard 1 card per empty supply pile
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";

export const poacher: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[player];

  // Count empty supply piles
  const emptyPiles = Object.values(state.supply).filter(
    count => count === 0,
  ).length;

  // Initial: +1 Card, +1 Action, +$1
  if (!decision || stage === undefined) {
    const drawEvents = createDrawEvents(player, playerState, 1);
    const actionEvent = { type: "ACTIONS_MODIFIED" as const, delta: 1 };
    const coinEvent = { type: "COINS_MODIFIED" as const, delta: 1 };
    const initialEvents = [...drawEvents, actionEvent, coinEvent];

    if (emptyPiles === 0 || playerState.hand.length === 0) {
      return { events: initialEvents };
    }

    const discardCount = Math.min(emptyPiles, playerState.hand.length);

    return {
      events: initialEvents,
      pendingDecision: {
        type: "card_decision",
        player,
        from: "hand",
        prompt: `Poacher: Discard ${discardCount} card(s) (${emptyPiles} empty pile(s))`,
        cardOptions: [...playerState.hand],
        min: discardCount,
        max: discardCount,
        cardBeingPlayed: "Poacher",
        stage: "discard",
      },
    };
  }

  // Discard (atomic events)
  if (stage === "discard") {
    const discardEvents = decision.selectedCards.map(card => ({
      type: "CARD_DISCARDED" as const,
      player,
      card,
      from: "hand" as const,
    }));
    return { events: discardEvents };
  }

  return { events: [] };
};
