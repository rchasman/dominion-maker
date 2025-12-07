/**
 * Bandit - Gain a Gold. Each other player reveals top 2 cards, trashes a non-Copper Treasure
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getOpponents, peekDraw } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARDS } from "../../data/cards";

export const bandit: CardEffect = ({ state, player }): CardEffectResult => {
  const events: GameEvent[] = [];
  const opponents = getOpponents(state, player);

  // Gain Gold
  if (state.supply.Gold > 0) {
    events.push({ type: "CARD_GAINED", player, card: "Gold", to: "discard" });
  }

  // Attack each opponent
  for (const opp of opponents) {
    const oppState = state.players[opp];
    if (!oppState) continue;

    // Reveal top 2 cards
    const { cards: revealed } = peekDraw(oppState, 2);

    if (revealed.length > 0) {
      // Reveal cards (atomic events)
      for (const card of revealed) {
        events.push({ type: "CARD_REVEALED", player: opp, card, from: "deck" });
      }

      // Find non-Copper treasures to trash (Silver or Gold)
      const trashable = revealed.filter(
        c => CARDS[c].types.includes("treasure") && c !== "Copper"
      );

      if (trashable.length > 0) {
        // Trash the first one (prefer Gold > Silver if multiple)
        const toTrash = trashable.includes("Gold") ? "Gold" : trashable[0];
        events.push({ type: "CARD_TRASHED", player: opp, card: toTrash, from: "deck" });

        // Remaining revealed cards go to discard (atomic events)
        const remaining = revealed.filter(c => c !== toTrash);
        for (const card of remaining) {
          events.push({ type: "CARD_DISCARDED", player: opp, card, from: "deck" });
        }
      } else {
        // No treasures to trash, all revealed go to discard (atomic events)
        for (const card of revealed) {
          events.push({ type: "CARD_DISCARDED", player: opp, card, from: "deck" });
        }
      }
    }
  }

  return { events };
};
