import type { CardEffect } from "../card-effect";

export const gardens: CardEffect = ({ state }) => {
  // Gardens is a victory card with no play effect
  // Its VP value (1 VP per 10 cards) is calculated in countVP
  return state;
};
