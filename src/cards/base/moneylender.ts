import type { CardEffect } from "../card-effect";

export const moneylender: CardEffect = ({ state, player, children }) => {
  // May trash Copper for +$3
  const currentPlayer = state.players[player];
  const copperIndex = currentPlayer.hand.indexOf("Copper");

  if (copperIndex !== -1) {
    const newHand = [...currentPlayer.hand];
    newHand.splice(copperIndex, 1);

    const newState = {
      ...state,
      players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
      trash: [...state.trash, "Copper"],
      coins: state.coins + 3,
    };
    children.push({ type: "trash-cards", player, count: 1, cards: ["Copper"] });
    children.push({ type: "get-coins", player, count: 3 });
    return newState;
  }

  return state;
};
