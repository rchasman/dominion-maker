import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const merchant: CardEffect = ({ state, player, children }) => {
  // +1 Card, +1 Action. First Silver played = +$1
  // Note: The +$1 bonus would need to be tracked in state, simplified for now
  const { player: newPlayer, drawn } = drawCards(state.players[player], 1);
  const newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
    actions: state.actions + 1,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-actions", player, count: 1 });
  return newState;
};
