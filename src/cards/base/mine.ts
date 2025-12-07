/**
 * Mine - Trash a Treasure from hand, gain a Treasure costing up to $3 more to hand
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARDS } from "../../data/cards";
import type { CardName } from "../../types/game-state";

export const mine: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];

  // Stage 1: Choose treasure to trash
  if (!decision || stage === undefined) {
    const treasures = playerState.hand.filter(
      c => CARDS[c].types.includes("treasure")
    );
    if (treasures.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Mine: Trash a Treasure from your hand",
        cardOptions: treasures,
        min: 1,
        max: 1,
        stage: "trash",
      },
    };
  }

  // Stage 2: Choose treasure to gain
  if (stage === "trash") {
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const trashCost = CARDS[toTrash].cost;
    const maxCost = trashCost + 3;

    // Find gainable treasures
    const gainableTreasures = Object.entries(state.supply)
      .filter(([card, count]) => {
        const cardDef = CARDS[card as CardName];
        return count > 0 &&
          cardDef.types.includes("treasure") &&
          cardDef.cost <= maxCost;
      })
      .map(([card]) => card as CardName);

    const events: GameEvent[] = [
      { type: "CARDS_TRASHED", player, cards: [toTrash], from: "hand" },
    ];

    if (gainableTreasures.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "supply",
        prompt: `Mine: Gain a Treasure costing up to $${maxCost} to your hand`,
        cardOptions: gainableTreasures,
        min: 1,
        max: 1,
        stage: "gain",
      },
    };
  }

  // Stage 3: Gain to hand
  if (stage === "gain") {
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "hand" }],
    };
  }

  return { events: [] };
};
