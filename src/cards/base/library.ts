/**
 * Library - Draw until you have 7 cards in hand, skipping any Actions you choose to
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw, isActionCard } from "../effect-types";
import type { CardName } from "../../types/game-state";
import { CARD_ACTIONS } from "../card-actions";

const TARGET_HAND_SIZE = 7;

// Helper to safely extract CardName[] from metadata
function getCardNamesFromMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string,
): CardName[] {
  const value = metadata?.[key];
  if (Array.isArray(value)) {
    return value as CardName[];
  }
  return [];
}

export const library: CardEffect = ({
  state,
  player,
  decision,
  stage,
}): CardEffectResult => {
  const playerState = state.players[player];

  // Library peek strategy:
  // Peeks ahead to see which cards would be drawn. If shuffle occurs during
  // actual drawing, peeked cards may not match drawn cards. This is acceptable
  // because: (1) shuffle is random, (2) players make choices on visible info,
  // (3) actual draws happen after decision and use final state

  if (!decision || stage === undefined) {
    const cardsNeeded = TARGET_HAND_SIZE - playerState.hand.length;

    if (cardsNeeded <= 0) {
      return { events: [] };
    }

    // Look at what we'd draw
    const { cards: peeked } = peekDraw(playerState, cardsNeeded);
    const actionsInDraw = peeked.filter(isActionCard);

    if (actionsInDraw.length === 0) {
      // No actions, just draw all
      const drawEvents = createDrawEvents(player, playerState, cardsNeeded);
      return { events: drawEvents };
    }

    // Ask which actions to skip
    // Use multi-action decision to handle duplicates properly
    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        prompt: "Library: Choose which Actions to skip",
        cardOptions: actionsInDraw,
        actions: [
          { ...CARD_ACTIONS.draw_card, isDefault: true },
          CARD_ACTIONS.discard_card,
        ],
        cardBeingPlayed: "Library",
        metadata: { cardsNeeded, peekedCards: peeked },
      },
    };
  }

  // Process decision with indices
  const peeked = getCardNamesFromMetadata(
    state.pendingDecision?.metadata,
    "peekedCards",
  );
  const cardActions = decision.cardActions || {};

  const drawEvents = Object.entries(cardActions)
    .map(([indexStr, action]) => ({ index: parseInt(indexStr), action }))
    .filter(({ index, action }) => action === "draw_card" && peeked[index])
    .map(({ index }) => ({
      type: "CARD_DRAWN" as const,
      player,
      card: peeked[index],
    }));

  const discardEvents = Object.entries(cardActions)
    .map(([indexStr, action]) => ({ index: parseInt(indexStr), action }))
    .filter(({ index, action }) => action === "discard_card" && peeked[index])
    .map(({ index }) => ({
      type: "CARD_DISCARDED" as const,
      player,
      card: peeked[index],
      from: "deck" as const,
    }));

  return { events: [...drawEvents, ...discardEvents] };
};
