import type { CardEffect } from "../card-effect";
import { drawCards, logDraw } from "../../lib/game-utils";

export const laboratory: CardEffect = ({ state, player, children }) => {
  // +2 Cards, +1 Action
  const drawResult = drawCards(state.players[player], 2);
  logDraw(children, drawResult, player);
  children.push({ type: "get-actions", player, count: 1 });
  return {
    ...state,
    players: { ...state.players, [player]: drawResult.player },
    actions: state.actions + 1,
  };
};
