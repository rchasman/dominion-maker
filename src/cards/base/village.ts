import type { CardEffect } from "../card-effect";
import { drawCards, logDraw } from "../../lib/game-utils";

export const village: CardEffect = ({ state, player, children }) => {
  // +1 Card, +2 Actions
  const drawResult = drawCards(state.players[player], 1);
  logDraw(children, drawResult, player);
  children.push({ type: "get-actions", player, count: 2 });
  return {
    ...state,
    players: { ...state.players, [player]: drawResult.player },
    actions: state.actions + 2,
  };
};
