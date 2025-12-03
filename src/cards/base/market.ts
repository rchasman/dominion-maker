import type { CardEffect } from "../card-effect";
import { drawCards, logDraw } from "../../lib/game-utils";

export const market: CardEffect = ({ state, player, children }) => {
  // +1 Card, +1 Action, +1 Buy, +$1
  const drawResult = drawCards(state.players[player], 1);
  logDraw(children, drawResult, player);
  children.push({ type: "get-actions", player, count: 1 });
  children.push({ type: "get-buys", player, count: 1 });
  children.push({ type: "get-coins", player, count: 1 });
  return {
    ...state,
    players: { ...state.players, [player]: drawResult.player },
    actions: state.actions + 1,
    buys: state.buys + 1,
    coins: state.coins + 1,
  };
};
