import type { CardEffect } from "../card-effect";
import { isActionCard } from "../../data/cards";

export const vassal: CardEffect = ({ state, player, children }) => {
  // +$2. Discard top of deck; if Action, may play it free
  const currentPlayer = state.players[player];
  let deck = [...currentPlayer.deck];
  let discard = [...currentPlayer.discard];

  // If deck empty, shuffle discard
  if (deck.length === 0 && discard.length > 0) {
    deck = [...discard];
    discard = [];
  }

  if (deck.length > 0) {
    const topCard = deck.shift()!;

    const newState = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...currentPlayer,
          deck,
          discard: [...discard, topCard],
        },
      },
      coins: state.coins + 2,
    };
    children.push({ type: "get-coins", player, count: 2 });
    children.push({ type: "text", message: `Discarded ${topCard}` });

    // If action card, play it (simplified: always play if possible)
    if (isActionCard(topCard)) {
      // Move to inPlay and recursively apply effect would be complex
      children.push({ type: "text", message: `(${topCard} played from discard - not fully implemented)` });
    }
    return newState;
  } else {
    const newState = {
      ...state,
      coins: state.coins + 2,
    };
    children.push({ type: "get-coins", player, count: 2 });
    return newState;
  }
};
