import type { CardEffect } from "../card-effect";

export const festival: CardEffect = ({ state, player, children }) => {
  // +2 Actions, +1 Buy, +$2
  const newState = {
    ...state,
    actions: state.actions + 2,
    buys: state.buys + 1,
    coins: state.coins + 2,
  };
  children.push({ type: "get-actions", player, count: 2 });
  children.push({ type: "get-buys", player, count: 1 });
  children.push({ type: "get-coins", player, count: 2 });
  return newState;
};
