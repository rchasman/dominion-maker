/**
 * Harbinger - +1 Card, +1 Action. Look through discard, may put a card on deck
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents } from "../effect-types";
import type { GameEvent } from "../../events/types";

export const harbinger: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];
  const events: GameEvent[] = [];

  // Initial: +1 Card, +1 Action
  if (!decision || stage === undefined) {
    events.push(...createDrawEvents(player, playerState, 1));
    events.push({ type: "ACTIONS_MODIFIED", delta: 1 });

    // If discard pile is empty, we're done
    if (playerState.discard.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "discard",
        prompt: "Harbinger: Put a card from your discard onto your deck (or skip)",
        cardOptions: [...playerState.discard],
        min: 0,
        max: 1,
        stage: "topdeck",
      },
    };
  }

  // Put card on deck
  if (stage === "topdeck") {
    if (decision.selectedCards.length > 0) {
      const card = decision.selectedCards[0];
      events.push({ type: "CARDS_PUT_ON_DECK", player, cards: [card], from: "discard" });
    }
    return { events };
  }

  return { events: [] };
};
