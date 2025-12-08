/**
 * Library - Draw until you have 7 cards in hand, skipping any Actions you choose to
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw, isActionCard } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName } from "../../types/game-state";

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
  const events: GameEvent[] = [];

  // Note: Library is complex because it needs to draw one at a time
  // For simplicity, we'll handle it as a single decision

  if (!decision || stage === undefined) {
    const cardsNeeded = 7 - playerState.hand.length;

    if (cardsNeeded <= 0) {
      return { events: [] };
    }

    // Look at what we'd draw
    const { cards: peeked } = peekDraw(playerState, cardsNeeded);
    const actionsInDraw = peeked.filter(isActionCard);

    if (actionsInDraw.length === 0) {
      // No actions, just draw all
      events.push(...createDrawEvents(player, playerState, cardsNeeded));
      return { events };
    }

    // Ask which actions to skip
    // Use multi-action decision to handle duplicates properly
    return {
      events: [],
      pendingDecision: {
        type: "card_decision",
        player,
        prompt: "Library: Choose which Actions to set aside",
        cardOptions: actionsInDraw,
        actions: [
          {
            id: "draw",
            label: "Draw",
            color: "#10B981",
            isDefault: true,
          },
          {
            id: "set_aside",
            label: "Set Aside",
            color: "#9CA3AF",
          },
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

  // Draw cards marked "draw" by index
  for (const [indexStr, action] of Object.entries(cardActions)) {
    const index = parseInt(indexStr);
    if (action === "draw" && peeked[index]) {
      events.push({ type: "CARD_DRAWN", player, card: peeked[index] });
    }
  }

  // Discard cards marked "set_aside" by index
  for (const [indexStr, action] of Object.entries(cardActions)) {
    const index = parseInt(indexStr);
    if (action === "set_aside" && peeked[index]) {
      events.push({
        type: "CARD_DISCARDED",
        player,
        card: peeked[index],
        from: "deck",
      });
    }
  }

  return { events };
};
