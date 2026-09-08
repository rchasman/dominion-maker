import { createAttackEffect } from "../attack-effect";
import { getOpponents } from "../effect-types";
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

const attack = createOpponentIteratorEffect<BureaucratData>(
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
      cardName,
    ) => ({
      choiceType: "decision",
      playerId: opponent,
      from: "hand",
      prompt: `${cardName}: Put a Victory card on your deck`,
      cardOptions: data.victoryCards,
      min: 1,
      max: 1,
      cardBeingPlayed: cardName,
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
          playerId: opponent,
          card: toPutOnDeck,
          from: "hand" as const,
        },
      ];
    },
    stage: STAGES.OPPONENT_TOPDECK,
  },
  (state, playerId, targets) =>
    (targets ?? getOpponents(state, playerId)).flatMap(target => {
      const hand = state.players[target]?.hand ?? [];
      return getVictoryCards(hand).length
        ? []
        : hand.map(card => ({
            type: "CARD_REVEALED" as const,
            playerId: target,
            card,
            from: "hand" as const,
          }));
    }),
);
export const bureaucrat = createAttackEffect(
  ({ playerId }) => ({
    events: [{ type: "CARD_GAINED", playerId, card: "Silver", to: "deck" }],
  }),
  attack,
);
