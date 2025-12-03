import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const village: CardEffect = ({ state, player, children }) => {
  // +1 Card, +2 Actions
  const { player: newPlayer, drawn } = drawCards(state.players[player], 1);
  const newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
    actions: state.actions + 2,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-actions", player, count: 2 });
  return newState;
};
