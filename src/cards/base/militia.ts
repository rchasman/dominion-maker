import type { CardEffect } from "../card-effect";

export const militia: CardEffect = ({ state, player, children }) => {
  // +$2, attack (simplified - no discard prompt for now)
  const newState = {
    ...state,
    coins: state.coins + 2,
  };
  children.push({ type: "get-coins", player, count: 2 });
  return newState;
};
