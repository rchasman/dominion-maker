/**
 * Council Room - +4 Cards, +1 Buy, each other player draws a card
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { createDrawEvents, getOpponents } from "../effect-types";
import type { GameEvent } from "../../events/types";

const CARDS_TO_DRAW = 4;

export const councilRoom: CardEffect = ({
  state,
  playerId,
}): CardEffectResult => {
  const playerState = state.players[playerId];
  if (!playerState) return { events: [] };

  const drawEvents = createDrawEvents(playerId, playerState, CARDS_TO_DRAW);

  const buyEvent: GameEvent = { type: "BUYS_MODIFIED", delta: 1 };

  // Each opponent draws a card
  const opponents = getOpponents(state, playerId);
  const opponentDrawEvents = opponents.flatMap(opponent => {
    const opponentState = state.players[opponent];
    return opponentState ? createDrawEvents(opponent, opponentState, 1) : [];
  });

  return { events: [...drawEvents, buyEvent, ...opponentDrawEvents] };
};
