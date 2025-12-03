import type { CardEffect } from "../card-effect";
import type { CardName } from "../../types/game-state";
import { CARDS } from "../../data/cards";

export const workshop: CardEffect = ({ state, player, children, decision }) => {
  // Gain a card costing up to $4
  const currentPlayer = state.players[player];

  // For human players, prompt for choice
  if (player === "human") {
    if (!decision) {
      // Find all cards we can gain (up to $4)
      const gainOptions: CardName[] = [];
      for (const [card, count] of Object.entries(state.supply)) {
        if (count > 0 && CARDS[card as CardName].cost <= 4) {
          gainOptions.push(card as CardName);
        }
      }

      if (gainOptions.length === 0) return state;

      return {
        ...state,
        pendingDecision: {
          type: "gain",
          player: "human",
          prompt: "Workshop: Gain a card costing up to $4",
          options: gainOptions,
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: { cardBeingPlayed: "Workshop", stage: "gain" },
        },
      };
    }

    // Gain the chosen card
    if (decision.selectedCards && decision.selectedCards.length > 0) {
      const gained = decision.selectedCards[0];

      const newState = {
        ...state,
        pendingDecision: null,
        players: {
          ...state.players,
          [player]: {
            ...currentPlayer,
            discard: [...currentPlayer.discard, gained],
          },
        },
        supply: {
          ...state.supply,
          [gained]: state.supply[gained] - 1,
        },
      };
      children.push({ type: "gain-card", player, card: gained });
      return newState;
    }

    return state;
  }

  // For AI: simplified auto-choose
  const options: CardName[] = ["Silver", "Village", "Smithy", "Cellar", "Chapel", "Moat", "Estate"];
  let gained: CardName | null = null;

  for (const option of options) {
    if (state.supply[option] > 0 && CARDS[option].cost <= 4) {
      gained = option;
      break;
    }
  }

  if (gained) {
    const newState = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...currentPlayer,
          discard: [...currentPlayer.discard, gained],
        },
      },
      supply: {
        ...state.supply,
        [gained]: state.supply[gained] - 1,
      },
    };
    children.push({ type: "gain-card", player, card: gained });
    return newState;
  }

  return state;
};
