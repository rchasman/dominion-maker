import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const moat: CardEffect = ({ state, player, children }) => {
  // +2 Cards
  const { player: newPlayer, drawn } = drawCards(state.players[player], 2);
  const newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  return newState;
};
