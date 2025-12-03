import type { CardEffect } from "../card-effect";
import type { CardName } from "../../types/game-state";
import { CARDS } from "../../data/cards";

export const remodel: CardEffect = ({ state, player, children, decision }) => {
  // Trash a card, gain one costing up to $2 more
  const currentPlayer = state.players[player];

  // For human players, use multi-stage decision process
  if (player === "human") {
    // Stage 1: Choose card to trash
    if (!decision) {
      if (currentPlayer.hand.length === 0) return state;

      return {
        ...state,
        pendingDecision: {
          type: "trash",
          player: "human",
          prompt: "Remodel: Choose a card to trash",
          options: [...currentPlayer.hand],
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: { cardBeingPlayed: "Remodel", stage: "trash" },
        },
      };
    }

    // Stage 2: Card trashed, now choose what to gain
    if (decision.stage === "trash" && decision.selectedCards && decision.selectedCards.length > 0) {
      const toTrash = decision.selectedCards[0];
      const newHand = [...currentPlayer.hand];
      const idx = newHand.indexOf(toTrash);
      if (idx === -1) return state;

      newHand.splice(idx, 1);

      const trashCost = CARDS[toTrash].cost;
      const maxCost = trashCost + 2;

      // Find all cards we can gain (up to maxCost)
      const gainOptions: CardName[] = [];
      for (const [card, count] of Object.entries(state.supply)) {
        if (count > 0 && CARDS[card as CardName].cost <= maxCost) {
          gainOptions.push(card as CardName);
        }
      }

      const newState = {
        ...state,
        players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
        trash: [...state.trash, toTrash],
      };
      children.push({ type: "trash-cards", player, count: 1, cards: [toTrash] });

      if (gainOptions.length === 0) {
        // No cards to gain
        return newState;
      }

      return {
        ...newState,
        pendingDecision: {
          type: "gain",
          player: "human",
          prompt: `Remodel: Gain a card costing up to $${maxCost}`,
          options: gainOptions,
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: { cardBeingPlayed: "Remodel", stage: "gain", trashed: toTrash },
        },
      };
    }

    // Stage 3: Gain the chosen card
    if (decision.stage === "gain" && decision.selectedCards && decision.selectedCards.length > 0) {
      const gained = decision.selectedCards[0];

      const newState = {
        ...state,
        pendingDecision: null, // Clear decision - we're done!
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

  // For AI: simplified auto-choose behavior
  const toTrash = currentPlayer.hand.find(c => c === "Curse") ||
                  currentPlayer.hand.find(c => c === "Copper") ||
                  currentPlayer.hand.find(c => c === "Estate");

  if (toTrash) {
    const newHand = [...currentPlayer.hand];
    const idx = newHand.indexOf(toTrash);
    newHand.splice(idx, 1);

    const trashCost = CARDS[toTrash].cost;
    const maxCost = trashCost + 2;

    // Gain best card up to maxCost (prioritize: Gold > Silver > Duchy > action cards)
    const options: CardName[] = ["Gold", "Silver", "Duchy", "Smithy", "Market", "Estate"];
    let gained: CardName | null = null;

    for (const option of options) {
      if (state.supply[option] > 0 && CARDS[option].cost <= maxCost) {
        gained = option;
        break;
      }
    }

    let newState = {
      ...state,
      players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
      trash: [...state.trash, toTrash],
    };
    children.push({ type: "trash-cards", player, count: 1, cards: [toTrash] });

    if (gained) {
      newState = {
        ...newState,
        players: {
          ...newState.players,
          [player]: {
            ...newState.players[player],
            discard: [...newState.players[player].discard, gained],
          },
        },
        supply: {
          ...newState.supply,
          [gained]: newState.supply[gained] - 1,
        },
      };
      children.push({ type: "gain-card", player, card: gained });
    }

    return newState;
  }

  return state;
};
