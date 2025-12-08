/**
 * Cellar - +1 Action. Discard any number of cards, then draw that many
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, isInitialCall, createCardSelectionDecision } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const cellar: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial call: +1 Action, then request discards
  if (isInitialCall(decision, stage)) {
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });

    if (playerState.hand.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: createCardSelectionDecision({
        player,
        from: "hand",
        prompt: "Cellar: Discard any number of cards to draw that many",
        cardOptions: [...playerState.hand],
        min: 0,
        max: playerState.hand.length,
        cardBeingPlayed: "Cellar",
        stage: "discard",
      }),
    };
  }

  // Process discards and draw
  if (stage === "discard" && decision) {
    const { selectedCards: toDiscard } = decision;

    if (toDiscard.length === 0) {
      return { events: [] };
    }

    // Discard selected cards (atomic events)
    const discardEvents = toDiscard.map(card => ({
      type: "CARD_DISCARDED" as const,
      player,
      card,
      from: "hand" as const,
    }));
    events.push(...discardEvents);

    // Draw equal number - compute from state AFTER discards
    const simulatedState = {
      ...playerState,
      hand: playerState.hand.filter(c => !toDiscard.includes(c)),
      discard: [...playerState.discard, ...toDiscard],
      deck: [...playerState.deck],
    };

    const drawEvents = createDrawEvents(player, simulatedState, toDiscard.length);
    events.push(...drawEvents);

    return { events };
  }

  return { events: [] };
};
