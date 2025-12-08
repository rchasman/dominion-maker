/**
 * Sentry - +1 Card, +1 Action. Look at top 2 cards of deck. Trash/Discard any, put rest back in any order
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName } from "../../types/game-state";

// Helper to safely extract CardName[] from metadata
function getCardNamesFromMetadata(metadata: Record<string, unknown> | undefined, key: string): CardName[] {
  const value = metadata?.[key];
  if (Array.isArray(value)) {
    return value as CardName[];
  }
  return [];
}

export const sentry: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial: +1 Card, +1 Action, look at top 2
  if (!decision || stage === undefined) {
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
        type: "select_cards",
        player,
        from: "revealed",
        prompt: "Sentry: Select cards to TRASH (others will be discarded or kept)",
        cardOptions: revealed,
        min: 0,
        max: revealed.length,
        cardBeingPlayed: "Sentry",
        stage: "trash",
        metadata: { revealedCards: revealed },
      },
    };
  }

  // Trash selected cards
  if (stage === "trash") {
    const revealed = getCardNamesFromMetadata(state.pendingDecision?.metadata, "revealedCards");
    const toTrash = decision.selectedCards;

    // Trash selected cards (atomic events)
    for (const card of toTrash) {
      events.push({ type: "CARD_TRASHED", player, card, from: "deck" });
    }

    const remaining = revealed.filter(c => !toTrash.includes(c));

    if (remaining.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "revealed",
        prompt: "Sentry: Select cards to DISCARD (rest go back on deck)",
        cardOptions: remaining,
        min: 0,
        max: remaining.length,
        cardBeingPlayed: "Sentry",
        stage: "discard",
        metadata: { remainingCards: remaining },
      },
    };
  }

  // Discard selected, rest go back on deck
  if (stage === "discard") {
    const remaining = getCardNamesFromMetadata(state.pendingDecision?.metadata, "remainingCards");
    const toDiscard = decision.selectedCards;

    // Discard selected cards (atomic events)
    for (const card of toDiscard) {
      events.push({ type: "CARD_DISCARDED", player, card, from: "deck" });
    }

    const toReturn = remaining.filter(c => !toDiscard.includes(c));

    if (toReturn.length > 1) {
      // Need to choose order
      return {
        events,
        pendingDecision: {
          type: "select_cards",
          player,
          from: "options",
          prompt: "Sentry: Choose order to put cards back (first = top)",
          cardOptions: toReturn,
          min: toReturn.length,
          max: toReturn.length,
          cardBeingPlayed: "Sentry",
          stage: "order",
          metadata: { cardsToReturn: toReturn },
        },
      };
    }

    // Single card or no cards, just put back
    if (toReturn.length === 1) {
      events.push({ type: "CARD_PUT_ON_DECK", player, card: toReturn[0], from: "hand" });
    }

    return { events };
  }

  // Order and return to deck (atomic events, reversed so first = top)
  if (stage === "order") {
    const orderedCards = [...decision.selectedCards].reverse();
    for (const card of orderedCards) {
      events.push({ type: "CARD_PUT_ON_DECK", player, card, from: "hand" });
    }
    return { events };
  }

  return { events: [] };
};
