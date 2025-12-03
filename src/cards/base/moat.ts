import type { CardEffect } from "../card-effect";
import { drawCards, logDraw } from "../../lib/game-utils";

export const moat: CardEffect = ({ state, player, children }) => {
  // +2 Cards
  const drawResult = drawCards(state.players[player], 2);
  logDraw(children, drawResult, player);
  return {
    ...state,
    players: { ...state.players, [player]: drawResult.player },
  };
};
