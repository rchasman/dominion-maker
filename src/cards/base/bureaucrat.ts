/**
 * Bureaucrat - Gain a Silver onto your deck. Each other player puts a Victory card from hand onto their deck
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARDS } from "../../data/cards";
import type { Player } from "../../types/game-state";

export const bureaucrat: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const events: GameEvent[] = [];
  const opponents = getOpponents(state, player);

  // Initial: Gain Silver to deck, then opponents react
  if (!decision || stage === undefined) {
    if (state.supply.Silver > 0) {
      events.push({ type: "CARD_GAINED", player, card: "Silver", to: "deck" });
    }

    // Find first opponent with a Victory card
    for (const opp of opponents) {
      const oppState = state.players[opp];
      if (!oppState) continue;

      const victoryCards = oppState.hand.filter(c => CARDS[c].types.includes("victory"));

      if (victoryCards.length > 0) {
        return {
          events,
          pendingDecision: {
            type: "select_cards",
            player: opp,
            from: "hand",
            prompt: "Bureaucrat: Put a Victory card on your deck",
            cardOptions: victoryCards,
            min: 1,
            max: 1,
            stage: "opponent_topdeck",
            metadata: { remainingOpponents: opponents.filter(o => o !== opp) },
          },
        };
      }
      // If no victory cards, reveal hand (handled in UI)
    }

    return { events };
  }

  // Process opponent's card to deck
  if (stage === "opponent_topdeck") {
    const toPutOnDeck = decision.selectedCards[0];
    const affectedPlayer = state.pendingDecision?.player as Player;

    if (toPutOnDeck) {
      events.push({ type: "CARDS_PUT_ON_DECK", player: affectedPlayer, cards: [toPutOnDeck], from: "hand" });
    }

    // Check for more opponents
    const metadata = state.pendingDecision?.metadata;
    const remainingOpponents = (metadata?.remainingOpponents as Player[]) || [];

    for (const opp of remainingOpponents) {
      const oppState = state.players[opp];
      if (!oppState) continue;

      const victoryCards = oppState.hand.filter(c => CARDS[c].types.includes("victory"));

      if (victoryCards.length > 0) {
        return {
          events,
          pendingDecision: {
            type: "select_cards",
            player: opp,
            from: "hand",
            prompt: "Bureaucrat: Put a Victory card on your deck",
            cardOptions: victoryCards,
            min: 1,
            max: 1,
            stage: "opponent_topdeck",
            metadata: { remainingOpponents: remainingOpponents.filter(o => o !== opp) },
          },
        };
      }
    }

    return { events };
  }

  return { events: [] };
};
