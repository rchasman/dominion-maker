import type { CardEffect } from "../card-effect";
import type { Player } from "../../types/game-state";
import { drawCards, logDraw } from "../../lib/game-utils";

export const councilRoom: CardEffect = ({ state, player, children }) => {
  // +4 Cards, +1 Buy, opponent draws 1
  const drawResult = drawCards(state.players[player], 4);
  const opponent: Player = player === "human" ? "ai" : "human";
  const oppDrawResult = drawCards(state.players[opponent], 1);

  logDraw(children, drawResult, player);
  children.push({ type: "get-buys", player, count: 1 });
  logDraw(children, oppDrawResult, opponent);

  return {
    ...state,
    players: { ...state.players, [player]: drawResult.player, [opponent]: oppDrawResult.player },
    buys: state.buys + 1,
  };
};
