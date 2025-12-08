/**
 * Chapel - Trash up to 4 cards from your hand
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { isInitialCall, createCardSelectionDecision } from "../effect-types";

export const chapel: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];

  // Request trash choice
  if (isInitialCall(decision, stage)) {
    if (playerState.hand.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: createCardSelectionDecision({
        player,
        from: "hand",
        prompt: "Chapel: Trash up to 4 cards from your hand",
        cardOptions: [...playerState.hand],
        min: 0,
        max: Math.min(4, playerState.hand.length),
        cardBeingPlayed: "Chapel",
        stage: "trash",
      }),
    };
  }

  // Execute trash (atomic events)
  if (!decision) return { events: [] };
  const toTrash = decision.selectedCards;
  if (toTrash.length === 0) return { events: [] };

  const events = toTrash.map(card => ({
    type: "CARD_TRASHED" as const,
    player,
    card,
    from: "hand" as const,
  }));

  return { events };
};
