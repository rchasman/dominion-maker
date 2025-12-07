/**
 * Library - Draw until you have 7 cards in hand, skipping any Actions you choose to
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, peekDraw } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARDS } from "../../data/cards";
import type { CardName } from "../../types/game-state";

function isActionCard(card: CardName): boolean {
  return CARDS[card].types.includes("action");
}

export const library: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
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
    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "revealed",
        prompt: "Library: Select Actions to set aside (will be discarded)",
        cardOptions: actionsInDraw,
        min: 0,
        max: actionsInDraw.length,
        cardBeingPlayed: "Library",
        stage: "skip_actions",
        metadata: { cardsNeeded, peekedCards: peeked },
      },
    };
  }

  if (stage === "skip_actions") {
    const metadata = state.pendingDecision?.metadata;
    const peeked = (metadata?.peekedCards as CardName[]) || [];
    const toSkip = decision.selectedCards;

    // Draw the non-skipped cards
    const toDraw = peeked.filter(c => !toSkip.includes(c));

    if (toDraw.length > 0) {
      events.push({ type: "CARDS_DRAWN", player, cards: toDraw });
    }

    // Discard the skipped actions
    if (toSkip.length > 0) {
      events.push({ type: "CARDS_DISCARDED", player, cards: toSkip, from: "deck" });
    }

    return { events };
  }

  return { events: [] };
};
