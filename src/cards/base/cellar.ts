/**
 * Cellar - +1 Action. Discard any number of cards, then draw that many
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const cellar: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial call: +1 Action, then request discards
  if (!decision || stage === undefined) {
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });

    if (playerState.hand.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Cellar: Discard any number of cards to draw that many",
        cardOptions: [...playerState.hand],
        min: 0,
        max: playerState.hand.length,
        cardBeingPlayed: "Cellar",
        stage: "discard",
      },
    };
  }

  // Process discards and draw
  if (stage === "discard") {
    const toDiscard = decision.selectedCards;

    if (toDiscard.length === 0) {
      return { events: [] };
    }

    // Discard selected cards
    events.push({
      type: "CARDS_DISCARDED",
      player,
      cards: toDiscard,
      from: "hand",
    });

    // Draw equal number
    // Need to compute draw from state AFTER discards
    const handAfterDiscard = playerState.hand.filter(c => !toDiscard.includes(c));
    const discardAfterDiscard = [...playerState.discard, ...toDiscard];
    const deckForDraw = [...playerState.deck];

    // Simulate the deck state after discarding
    const simulatedState = {
      ...playerState,
      hand: handAfterDiscard,
      discard: discardAfterDiscard,
      deck: deckForDraw,
    };

    const drawEvents = createDrawEvents(player, simulatedState, toDiscard.length);
    events.push(...drawEvents);

    return { events };
  }

  return { events: [] };
};
