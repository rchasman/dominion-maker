import type { CardEffect } from "../card-effect";
import { drawCards, logDraw } from "../../lib/game-utils";

export const smithy: CardEffect = ({ state, player, children }) => {
  // +3 Cards
  const drawResult = drawCards(state.players[player], 3);
  logDraw(children, drawResult, player);
  return {
    ...state,
    players: { ...state.players, [player]: drawResult.player },
  };
};
