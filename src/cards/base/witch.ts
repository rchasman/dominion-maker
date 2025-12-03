import type { CardEffect } from "../card-effect";
import type { Player } from "../../types/game-state";
import { drawCards, logDraw } from "../../lib/game-utils";

export const witch: CardEffect = ({ state, player, children }) => {
  // +2 Cards, opponent gains Curse
  const drawResult = drawCards(state.players[player], 2);
  const opponent: Player = player === "human" ? "ai" : "human";

  let newState = {
    ...state,
    players: { ...state.players, [player]: drawResult.player },
  };
  logDraw(children, drawResult, player);

  // Opponent gains Curse if available
  if (newState.supply.Curse > 0) {
    const oppState = newState.players[opponent];
    newState = {
      ...newState,
      players: {
        ...newState.players,
        [opponent]: {
          ...oppState,
          discard: [...oppState.discard, "Curse"],
        },
      },
      supply: {
        ...newState.supply,
        Curse: newState.supply.Curse - 1,
      },
    };
    children.push({ type: "gain-card", player: opponent, card: "Curse" });
  }

  return newState;
};
