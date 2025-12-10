/**
 * Militia - +$2. Each other player discards down to 3 cards in hand
 */

import { createOpponentIteratorEffect } from "../effect-types";

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
      attackingPlayer,
    ) => ({
      type: "card_decision",
      player: opponent,
      from: "hand",
      prompt: `Militia: Discard down to 3 cards (discard ${data.discardCount})`,
      cardOptions: [...data.hand],
      min: data.discardCount,
      max: data.discardCount,
      cardBeingPlayed: "Militia",
      stage: "opponent_discard",
      metadata: {
        remainingOpponents,
        attackingPlayer,
      },
    }),
    processChoice: (choice, { opponent }) =>
      (choice.selectedCards || []).map(card => ({
        type: "CARD_DISCARDED" as const,
        player: opponent,
        card,
        from: "hand" as const,
      })),
    stage: "opponent_discard",
  },
  [{ type: "COINS_MODIFIED", delta: MILITIA_COIN_BONUS }],
);
