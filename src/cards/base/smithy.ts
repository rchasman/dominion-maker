import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const smithy: CardEffect = ({ state, player, children }) => {
  // +3 Cards
  const { player: newPlayer, drawn } = drawCards(state.players[player], 3);
  const newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  return newState;
};
