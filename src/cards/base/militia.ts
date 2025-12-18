/**
 * Militia - +$2. Each other player discards down to 3 cards in hand
 */

import { createOpponentIteratorEffect } from "../effect-types";
import { STAGES } from "../stages";

const MILITIA_HAND_LIMIT = 3;
const MILITIA_COIN_BONUS = 2;

type MilitiaData = {
  hand: string[];
  discardCount: number;
};

export const militia = createOpponentIteratorEffect<MilitiaData>(
  {
    filter: (opponent, state) => {
      const oppState = state.players[opponent];
      if (!oppState || oppState.hand.length <= MILITIA_HAND_LIMIT) return null;

      return {
        opponent,
        data: {
          hand: oppState.hand,
          discardCount: oppState.hand.length - MILITIA_HAND_LIMIT,
        },
      };
    },
    createDecision: (
      { opponent, data },
      remainingOpponents,
      attackingPlayer
    ) => ({
      choiceType: "decision",
      playerId: opponent,
      from: "hand",
      prompt: `Militia: Discard down to 3 cards (discard ${data.discardCount})`,
      cardOptions: [...data.hand],
      min: data.discardCount,
      max: data.discardCount,
      cardBeingPlayed: "Militia",
      stage: STAGES.OPPONENT_DISCARD,
      metadata: {
        remainingOpponents,
        attackingPlayer,
      },
    }),
    processChoice: (choice, { opponent }) =>
      (choice.selectedCards || []).map(card => ({
        type: "CARD_DISCARDED" as const,
        playerId: opponent,
        card,
        from: "hand" as const,
      })),
    stage: STAGES.OPPONENT_DISCARD,
  },
  [{ type: "COINS_MODIFIED", delta: MILITIA_COIN_BONUS }]
);
