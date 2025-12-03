import type { CardEffect } from "../card-effect";
import type { CardName } from "../../types/game-state";

export const chapel: CardEffect = ({ state, player, children, decision }) => {
  // Trash up to 4 cards from hand
  const currentPlayer = state.players[player];
  const MAX_TRASH = 4;

  // For human players, iterative trash decisions
  if (player === "human") {
    // Track trashed cards from metadata
    const trashedCards: CardName[] =
      (decision?.metadata?.trashedCards as CardName[]) || [];

    // If we just made a selection, process it
    if (decision && decision.selectedCards) {
      // Skip was clicked (empty selection)
      if (decision.selectedCards.length === 0) {
        return { ...state, pendingDecision: null };
      }

      // Card was selected to trash
      const toTrash = decision.selectedCards[0];
      const newHand = [...currentPlayer.hand];
      const idx = newHand.indexOf(toTrash);

      // Validate card is in hand
      if (idx === -1) {
        console.error(`Chapel: Card ${toTrash} not found in hand`);
        return state;
      }

      // Remove from hand and add to trash
      newHand.splice(idx, 1);
      const newTrashedCards = [...trashedCards, toTrash];

      const newState = {
        ...state,
        players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
        trash: [...state.trash, toTrash],
      };
      children.push({ type: "trash-card", player, card: toTrash });

      // Update currentPlayer reference
      const updatedPlayer = newState.players[player];

      // Auto-complete if reached max or hand is empty
      if (newTrashedCards.length >= MAX_TRASH || updatedPlayer.hand.length === 0) {
        return { ...newState, pendingDecision: null };
      }

      // Prompt for more trashing
      return {
        ...newState,
        pendingDecision: {
          type: "trash",
          player: "human",
          prompt: `Chapel: Trash up to ${MAX_TRASH - newTrashedCards.length} more cards (or skip)`,
          options: [...updatedPlayer.hand],
          minCount: 0,
          maxCount: 1,
          canSkip: true,
          metadata: {
            cardBeingPlayed: "Chapel",
            trashedCards: newTrashedCards,
          },
        },
      };
    }

    // Initial prompt (no decision yet)
    if (!decision) {
      // Auto-complete if hand is empty
      if (currentPlayer.hand.length === 0) {
        return { ...state, pendingDecision: null };
      }

      return {
        ...state,
        pendingDecision: {
          type: "trash",
          player: "human",
          prompt: "Chapel: Trash up to 4 cards from your hand (or skip)",
          options: [...currentPlayer.hand],
          minCount: 0,
          maxCount: 1,
          canSkip: true,
          metadata: {
            cardBeingPlayed: "Chapel",
            trashedCards: [],
          },
        },
      };
    }

    return state;
  }

  // For AI: auto-trash Curses and Coppers (up to 4)
  const toTrash = currentPlayer.hand
    .filter(c => c === "Curse" || c === "Copper")
    .slice(0, MAX_TRASH);

  if (toTrash.length > 0) {
    const newHand = [...currentPlayer.hand];
    for (const trashCard of toTrash) {
      const idx = newHand.indexOf(trashCard);
      if (idx !== -1) newHand.splice(idx, 1);
    }

    const newState = {
      ...state,
      players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
      trash: [...state.trash, ...toTrash],
    };
    children.push({ type: "trash-card", player, card: toTrash[0] });
    return newState;
  }

  return state;
};
