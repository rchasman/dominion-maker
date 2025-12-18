/**
 * Cellar - +1 Action. Discard any number of cards, then draw that many
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, isInitialCall } from "../effect-types";
import { STAGES } from "../stages";

export const cellar: CardEffect = ({
  state,
  playerId,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[playerId]!;

  // Initial call: +1 Action, then request batch discard
  if (isInitialCall(decision, stage)) {
    const actionEvent = { type: "ACTIONS_MODIFIED" as const, delta: 1 };

    if (playerState.hand.length === 0) {
      return { events: [actionEvent] };
    }

    return {
      events: [actionEvent],
      pendingChoice: {
        choiceType: "decision",
        playerId,
        from: "hand",
        prompt: "Cellar: Discard any number of cards, then draw that many",
        cardOptions: [...playerState.hand],
        min: 0,
        max: playerState.hand.length,
        cardBeingPlayed: "Cellar",
        stage: STAGES.DISCARD,
      },
    };
  }

  // Process discard decision
  if (stage === STAGES.DISCARD && decision) {
    const toDiscard = decision.selectedCards;

    if (toDiscard.length === 0) {
      return { events: [] };
    }

    // Emit one event per discarded card
    const discardEvents = toDiscard.map(card => ({
      type: "CARD_DISCARDED" as const,
      playerId,
      card,
      from: "hand" as const,
    }));

    // Calculate updated hand for drawing
    const updatedHand = toDiscard.reduce((hand, card) => {
      const idx = hand.indexOf(card);
      return idx === -1
        ? hand
        : [...hand.slice(0, idx), ...hand.slice(idx + 1)];
    }, playerState.hand);

    // Simulate discarded state for drawing
    const simulatedState = {
      ...playerState,
      hand: updatedHand,
      discard: [...playerState.discard, ...toDiscard],
      deck: [...playerState.deck],
    };

    const drawEvents = createDrawEvents(
      playerId,
      simulatedState,
      toDiscard.length,
    );

    return { events: [...discardEvents, ...drawEvents] };
  }

  return { events: [] };
};
