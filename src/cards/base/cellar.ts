/**
 * Cellar - +1 Action. Discard any number of cards (one at a time), then draw that many
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import {
  createDrawEvents,
  isInitialCall,
  createCardSelectionDecision,
} from "../effect-types";
import { removeCards } from "../../lib/card-array-utils";

export const cellar: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[player];

  // Initial call: +1 Action, then request discards
  if (isInitialCall(decision, stage)) {
    const actionEvent = { type: "ACTIONS_MODIFIED" as const, delta: 1 };

    if (playerState.hand.length === 0) {
      return { events: [actionEvent] };
    }

    return {
      events: [actionEvent],
      pendingDecision: createCardSelectionDecision({
        player,
        from: "hand",
        prompt: "Cellar: Discard a card (or skip to draw)",
        cardOptions: [...playerState.hand],
        min: 0,
        max: 1,
        canSkip: true,
        cardBeingPlayed: "Cellar",
        stage: "discard",
        metadata: { discardedCount: 0 },
      }),
    };
  }

  // Handle skip: draw cards equal to number discarded
  if (stage === "on_skip") {
    const discardedCount =
      (state.pendingDecision?.metadata?.discardedCount as number) || 0;

    if (discardedCount === 0) {
      return { events: [] };
    }

    const drawEvents = createDrawEvents(player, playerState, discardedCount);
    return { events: drawEvents };
  }

  // Process discard decision
  if (stage === "discard" && decision) {
    const toDiscard = decision.selectedCards[0];
    if (!toDiscard) {
      throw new Error("Cellar discard requires card - use SKIP_DECISION to skip");
    }

    const discardedCount =
      (state.pendingDecision?.metadata?.discardedCount as number) || 0;

    const newDiscardedCount = discardedCount + 1;
    const updatedHand = removeCards(playerState.hand, [toDiscard]);

    // Player discarded a card
    const discardEvent = {
      type: "CARD_DISCARDED" as const,
      player,
      card: toDiscard,
      from: "hand" as const,
    };

    // Continue if still have cards in hand
    if (updatedHand.length > 0) {
      return {
        events: [discardEvent],
        pendingDecision: createCardSelectionDecision({
          player,
          from: "hand",
          prompt: `Cellar: Discard another card (${newDiscardedCount} discarded, or skip to draw ${newDiscardedCount})`,
          cardOptions: updatedHand,
          min: 0,
          max: 1,
          canSkip: true,
          cardBeingPlayed: "Cellar",
          stage: "discard",
          metadata: { discardedCount: newDiscardedCount },
        }),
      };
    }

    // No more cards in hand - auto-draw
    const simulatedState = {
      ...playerState,
      hand: removeCards(playerState.hand, [toDiscard]),
      discard: [...playerState.discard, toDiscard],
      deck: [...playerState.deck],
    };
    const drawEvents = createDrawEvents(
      player,
      simulatedState,
      newDiscardedCount,
    );
    return { events: [discardEvent, ...drawEvents] };
  }

  return { events: [] };
};
