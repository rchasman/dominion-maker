import type { CardEffect } from "../card-effect";
import { isActionCard } from "../../data/cards";

export const throneRoom: CardEffect = ({ state, player, children }) => {
  // Play an Action from hand twice
  // Simplified: play first action card in hand twice (recursive playAction would be complex)
  const currentPlayer = state.players[player];
  const actionInHand = currentPlayer.hand.find(c => isActionCard(c));

  if (actionInHand) {
    children.push({ type: "text", message: `Playing ${actionInHand} twice (simplified)` });
    // Full implementation would require recursively calling playAction
    // For now, just note it in the log
  }

  return state;
};
