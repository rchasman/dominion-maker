import type { CardEffect } from "../card-effect";
import type { Player } from "../../types/game-state";
import { drawCards } from "../../lib/game-utils";

export const councilRoom: CardEffect = ({ state, player, children }) => {
  // +4 Cards, +1 Buy, opponent draws 1
  const { player: newPlayer, drawn } = drawCards(state.players[player], 4);
  const opponent: Player = player === "human" ? "ai" : "human";
  const { player: oppPlayer, drawn: oppDrawn } = drawCards(state.players[opponent], 1);
  const newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer, [opponent]: oppPlayer },
    buys: state.buys + 1,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-buys", player, count: 1 });
  children.push({ type: "draw-cards", player: opponent, count: oppDrawn.length, cards: oppDrawn });
  return newState;
};
