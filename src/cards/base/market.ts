import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const market: CardEffect = ({ state, player, children }) => {
  // +1 Card, +1 Action, +1 Buy, +$1
  const { player: newPlayer, drawn } = drawCards(state.players[player], 1);
  const newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
    actions: state.actions + 1,
    buys: state.buys + 1,
    coins: state.coins + 1,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-actions", player, count: 1 });
  children.push({ type: "get-buys", player, count: 1 });
  children.push({ type: "get-coins", player, count: 1 });
  return newState;
};
