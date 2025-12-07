/**
 * Poacher - +1 Card, +1 Action, +$1. Discard 1 card per empty supply pile
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const poacher: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Count empty supply piles
  const emptyPiles = Object.values(state.supply).filter(count => count === 0).length;

  // Initial: +1 Card, +1 Action, +$1
  if (!decision || stage === undefined) {
    events.push(...createDrawEvents(player, playerState, 1));
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });
    events.push({ type: "COINS_MODIFIED", delta: 1 });

    if (emptyPiles === 0 || playerState.hand.length === 0) {
      return { events };
    }

    const discardCount = Math.min(emptyPiles, playerState.hand.length);

    return {
      events,
      pendingDecision: {
        type: "select_cards",
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

  // Discard
  if (stage === "discard") {
    if (decision.selectedCards.length > 0) {
      events.push({ type: "CARDS_DISCARDED", player, cards: decision.selectedCards, from: "hand" });
    }
    return { events };
  }

  return { events: [] };
};
