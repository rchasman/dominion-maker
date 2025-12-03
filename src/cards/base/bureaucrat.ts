import type { CardEffect } from "../card-effect";
import type { Player } from "../../types/game-state";

export const bureaucrat: CardEffect = ({ state, player, children }) => {
  // Gain Silver onto deck. Attack: others put Victory onto deck
  const currentPlayer = state.players[player];
  const opponent: Player = player === "human" ? "ai" : "human";

  let newState = state;

  // Gain Silver to top of deck
  if (state.supply.Silver > 0) {
    newState = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...currentPlayer,
          deck: ["Silver", ...currentPlayer.deck],
        },
      },
      supply: {
        ...state.supply,
        Silver: state.supply.Silver - 1,
      },
    };
    children.push({ type: "gain-card", player, card: "Silver" });
  }

  // Attack: opponent puts victory card on deck (simplified)
  const oppPlayer = newState.players[opponent];
  const victoryInHand = oppPlayer.hand.find(c => c === "Province" || c === "Duchy" || c === "Estate");
  if (victoryInHand) {
    const newOppHand = [...oppPlayer.hand];
    const idx = newOppHand.indexOf(victoryInHand);
    newOppHand.splice(idx, 1);

    newState = {
      ...newState,
      players: {
        ...newState.players,
        [opponent]: {
          ...oppPlayer,
          hand: newOppHand,
          deck: [victoryInHand, ...oppPlayer.deck],
        },
      },
    };
    children.push({ type: "text", message: `${opponent} put ${victoryInHand} on deck` });
  }

  return newState;
};
