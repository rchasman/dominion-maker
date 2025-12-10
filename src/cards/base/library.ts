/**
 * Library - Draw until you have 7 cards in hand, skipping any Actions you choose to
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw, isActionCard } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName } from "../../types/game-state";

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
  const events: GameEvent[] = [];

  // Note: Library is complex because it needs to draw one at a time
  // For simplicity, we'll handle it as a single decision

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
  const drawEvents = Object.entries(cardActions)
    .map(([indexStr, action]) => ({ index: parseInt(indexStr), action }))
    .filter(({ index, action }) => action === "draw" && peeked[index])
    .map(({ index }) => ({
      type: "CARD_DRAWN" as const,
      player,
      card: peeked[index],
    }));

  events.push(...drawEvents);

  // Discard cards marked "set_aside" by index
  const discardEvents = Object.entries(cardActions)
    .map(([indexStr, action]) => ({ index: parseInt(indexStr), action }))
    .filter(({ index, action }) => action === "set_aside" && peeked[index])
    .map(({ index }) => ({
      type: "CARD_DISCARDED" as const,
      player,
      card: peeked[index],
      from: "deck" as const,
    }));

  events.push(...discardEvents);

  return { events };
};
