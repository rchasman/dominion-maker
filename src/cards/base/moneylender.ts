import type { CardEffect } from "../card-effect";
import type { CardName } from "../../types/game-state";

export const moneylender: CardEffect = ({ state, player, children }) => {
  // May trash Copper for +$3
  const currentPlayer = state.players[player];
  const copperIndex = currentPlayer.hand.indexOf("Copper");

  if (copperIndex !== -1) {
    const newHand = [...currentPlayer.hand];
    newHand.splice(copperIndex, 1);

    const copper: CardName = "Copper";
    const newState = {
      ...state,
      players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
      trash: [...state.trash, copper],
      coins: state.coins + 3,
    };
    children.push({ type: "trash-card", player, card: copper });
    children.push({ type: "get-coins", player, count: 3 });
    return newState;
  }

  return state;
};
