/**
 * Remodel - Trash a card from hand, gain a card costing up to $2 more
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getGainableCards } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARDS } from "../../data/cards";

export const remodel: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];

  // Stage 1: Choose card to trash
  if (!decision || stage === undefined) {
    if (playerState.hand.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Remodel: Choose a card to trash",
        cardOptions: [...playerState.hand],
        min: 1,
        max: 1,
        cardBeingPlayed: "Remodel",
        stage: "trash",
      },
    };
  }

  // Stage 2: Trash chosen, now choose gain
  if (stage === "trash") {
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const trashCost = CARDS[toTrash].cost;
    const maxCost = trashCost + 2;
    const gainOptions = getGainableCards(state, maxCost);

    const events: GameEvent[] = [
      { type: "CARDS_TRASHED", player, cards: [toTrash], from: "hand" },
    ];

    if (gainOptions.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "supply",
        prompt: `Remodel: Gain a card costing up to $${maxCost}`,
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        cardBeingPlayed: "Remodel",
        stage: "gain",
        metadata: { trashedCard: toTrash, maxCost },
      },
    };
  }

  // Stage 3: Execute gain
  if (stage === "gain") {
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "discard" }],
    };
  }

  return { events: [] };
};
