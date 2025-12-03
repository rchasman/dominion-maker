import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const poacher: CardEffect = ({ state, player, children }) => {
  // +1 Card, +1 Action, +$1. Discard per empty Supply pile
  const { player: newPlayer, drawn } = drawCards(state.players[player], 1);
  const emptyPiles = Object.values(state.supply).filter(n => n === 0).length;

  let newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
    actions: state.actions + 1,
    coins: state.coins + 1,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-actions", player, count: 1 });
  children.push({ type: "get-coins", player, count: 1 });

  // Discard cards equal to empty piles (simplified: discard worst cards)
  if (emptyPiles > 0) {
    const currentPlayer = newState.players[player];
    const toDiscard = currentPlayer.hand
      .filter(c => c === "Copper" || c === "Estate" || c === "Curse")
      .slice(0, emptyPiles);

    if (toDiscard.length > 0) {
      const newHand = [...currentPlayer.hand];
      for (const card of toDiscard) {
        const idx = newHand.indexOf(card);
        if (idx !== -1) newHand.splice(idx, 1);
      }

      newState = {
        ...newState,
        players: {
          ...newState.players,
          [player]: {
            ...currentPlayer,
            hand: newHand,
            discard: [...currentPlayer.discard, ...toDiscard],
          },
        },
      };
      children.push({ type: "discard-cards", player, count: toDiscard.length, cards: toDiscard });
    }
  }

  return newState;
};
