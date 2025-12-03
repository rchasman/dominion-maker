import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const laboratory: CardEffect = ({ state, player, children }) => {
  // +2 Cards, +1 Action
  const { player: newPlayer, drawn } = drawCards(state.players[player], 2);
  const newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
    actions: state.actions + 1,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-actions", player, count: 1 });
  return newState;
};
