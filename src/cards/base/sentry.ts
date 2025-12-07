/**
 * Sentry - +1 Card, +1 Action. Look at top 2 cards of deck. Trash/Discard any, put rest back in any order
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw } from "../effect-types";
import type { GameEvent } from "../../events/types";
import type { CardName } from "../../types/game-state";

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

    events.push({ type: "CARDS_REVEALED", player, cards: revealed, from: "deck" });

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
    const metadata = state.pendingDecision?.metadata;
    const revealed = (metadata?.revealedCards as CardName[]) || [];
    const toTrash = decision.selectedCards;

    if (toTrash.length > 0) {
      events.push({ type: "CARDS_TRASHED", player, cards: toTrash, from: "deck" });
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
    const metadata = state.pendingDecision?.metadata;
    const remaining = (metadata?.remainingCards as CardName[]) || [];
    const toDiscard = decision.selectedCards;

    if (toDiscard.length > 0) {
      events.push({ type: "CARDS_DISCARDED", player, cards: toDiscard, from: "deck" });
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
      events.push({ type: "CARDS_PUT_ON_DECK", player, cards: toReturn, from: "hand" });
    }

    return { events };
  }

  // Order and return to deck
  if (stage === "order") {
    const orderedCards = decision.selectedCards;
    if (orderedCards.length > 0) {
      // Put in reverse order so first selected ends up on top
      events.push({ type: "CARDS_PUT_ON_DECK", player, cards: [...orderedCards].reverse(), from: "hand" });
    }
    return { events };
  }

  return { events: [] };
};
