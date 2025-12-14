/**
 * Bureaucrat - Gain a Silver onto your deck. Each other player puts a Victory card from hand onto their deck
 */

import { createOpponentIteratorEffect } from "../effect-types";
import { CARDS } from "../../data/cards";
import type { CardName } from "../../types/game-state";
import { STAGES } from "../stages";

type BureaucratData = {
  victoryCards: CardName[];
};

const getVictoryCards = (hand: CardName[]): CardName[] =>
  hand.filter(c => CARDS[c].types.includes("victory"));

export const bureaucrat = createOpponentIteratorEffect<BureaucratData>(
  {
    filter: (opponent, state) => {
      const oppState = state.players[opponent];
      if (!oppState) return null;

      const victoryCards = getVictoryCards(oppState.hand);
      if (victoryCards.length === 0) return null;

      return {
        opponent,
        data: { victoryCards },
      };
    },
    createDecision: (
      { opponent, data },
      remainingOpponents,
      attackingPlayer,
    ) => ({
      type: "card_decision",
      player: opponent,
      from: "hand",
      prompt: "Bureaucrat: Put a Victory card on your deck",
      cardOptions: data.victoryCards,
      min: 1,
      max: 1,
      cardBeingPlayed: "Bureaucrat",
      stage: STAGES.OPPONENT_TOPDECK,
      metadata: {
        remainingOpponents,
        attackingPlayer,
      },
    }),
    processChoice: (choice, { opponent }) => {
      const toPutOnDeck = choice.selectedCards[0];
      if (!toPutOnDeck) return [];

      return [
        {
          type: "CARD_PUT_ON_DECK" as const,
          player: opponent,
          card: toPutOnDeck,
          from: "hand" as const,
        },
      ];
    },
    stage: STAGES.OPPONENT_TOPDECK,
  },
  (state, player) => [
    {
      type: "CARD_GAINED" as const,
      player,
      card: "Silver" as const,
      to: "deck" as const,
    },
  ],
);
