/**
 * Sentry - +1 Card, +1 Action. Look at top 2 cards of deck. Trash/Discard any, put rest back in any order
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName } from "../../types/game-state";

export const sentry: CardEffect = ({
  state,
  player,
  decision,
}): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial: +1 Card, +1 Action, look at top 2
  if (!decision) {
    events.push(...createDrawEvents(player, playerState, 1));
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });

    const { cards: revealed } = peekDraw(playerState, 2);

    if (revealed.length === 0) {
      return { events };
    }

    // Reveal cards (atomic events)
    for (const card of revealed) {
      events.push({ type: "CARD_REVEALED", player, card, from: "deck" });
    }

    return {
      events,
      pendingDecision: {
        type: "card_decision",
        player,
        prompt: "Sentry: Choose what to do with each card",
        cardOptions: revealed,
        actions: [
          {
            id: "topdeck",
            label: "Topdeck",
            color: "#10B981",
            isDefault: true,
          },
          {
            id: "trash",
            label: "Trash",
            color: "#EF4444",
          },
          {
            id: "discard",
            label: "Discard",
            color: "#9CA3AF",
          },
        ],
        requiresOrdering: true,
        orderingPrompt:
          "Cards to topdeck will return in this order (first = top)",
        cardBeingPlayed: "Sentry",
        metadata: { revealedCards: revealed },
      },
    };
  }

  // Process the decision - cardActions uses indices as keys
  const revealed =
    (state.pendingDecision?.metadata?.revealedCards as CardName[]) || [];
  const cardActions = decision.cardActions || {};
  const cardOrder = (decision.cardOrder || []) as number[];

  // Trash cards by index
  for (const [indexStr, action] of Object.entries(cardActions)) {
    const index = parseInt(indexStr);
    if (action === "trash" && revealed[index]) {
      events.push({
        type: "CARD_TRASHED",
        player,
        card: revealed[index],
        from: "deck",
      });
    }
  }

  // Discard cards by index
  for (const [indexStr, action] of Object.entries(cardActions)) {
    const index = parseInt(indexStr);
    if (action === "discard" && revealed[index]) {
      events.push({
        type: "CARD_DISCARDED",
        player,
        card: revealed[index],
        from: "deck",
      });
    }
  }

  // Return topdecked cards to deck in order (reversed so first = top)
  // If cardOrder is provided, use it; otherwise use all topdeck cards in original order
  const topdeckIndices =
    cardOrder.length > 0
      ? cardOrder
      : Object.entries(cardActions)
          .filter(([, action]) => action === "topdeck")
          .map(([indexStr]) => parseInt(indexStr));

  for (let i = topdeckIndices.length - 1; i >= 0; i--) {
    const index = topdeckIndices[i];
    if (revealed[index]) {
      events.push({
        type: "CARD_PUT_ON_DECK",
        player,
        card: revealed[index],
        from: "hand",
      });
    }
  }

  return { events };
};
