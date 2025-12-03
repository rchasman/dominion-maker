import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";
import type { CardName } from "../../types/game-state";

export const cellar: CardEffect = ({ state, player, children, decision }) => {
  // +1 Action. Discard any number, draw that many
  const currentPlayer = state.players[player];
  let newState = state;

  // Apply immediate effects ONLY on initial call
  if (!decision) {
    newState = {
      ...state,
      actions: state.actions + 1,
    };
    children.push({ type: "get-actions", player, count: 1 });
  }

  // For human players, iterative discard decisions
  if (player === "human") {
    // Track discarded cards from metadata
    const discardedCards: CardName[] =
      (decision?.metadata?.discardedCards as CardName[]) || [];

    // If we just made a selection, process it
    if (decision && decision.selectedCards) {
      // Skip was clicked (empty selection)
      if (decision.selectedCards.length === 0) {
        // Draw cards equal to discarded count and finish
        if (discardedCards.length > 0) {
          const { player: afterDraw, drawn } = drawCards(currentPlayer, discardedCards.length);
          newState = {
            ...newState,
            players: { ...newState.players, [player]: afterDraw },
          };
          children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
        }
        return { ...newState, pendingDecision: null };
      }

      // Card was selected to discard
      const toDiscard = decision.selectedCards[0];
      const newHand = [...currentPlayer.hand];
      const idx = newHand.indexOf(toDiscard);

      // Validate card is in hand
      if (idx === -1) {
        console.error(`Cellar: Card ${toDiscard} not found in hand`);
        return newState;
      }

      // Remove from hand and add to discard
      newHand.splice(idx, 1);
      const newDiscard = [...currentPlayer.discard, toDiscard];
      const newDiscardedCards = [...discardedCards, toDiscard];

      newState = {
        ...newState,
        players: {
          ...newState.players,
          [player]: {
            ...currentPlayer,
            hand: newHand,
            discard: newDiscard,
          },
        },
      };
      children.push({ type: "discard-cards", player, count: 1, cards: [toDiscard] });

      // Update currentPlayer reference
      const updatedPlayer = newState.players[player];

      // Auto-complete if hand is empty
      if (updatedPlayer.hand.length === 0) {
        const { player: afterDraw, drawn } = drawCards(updatedPlayer, newDiscardedCards.length);
        newState = {
          ...newState,
          players: { ...newState.players, [player]: afterDraw },
          pendingDecision: null,
        };
        children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
        return newState;
      }

      // Prompt for more discards
      return {
        ...newState,
        pendingDecision: {
          type: "discard",
          player: "human",
          prompt: `Cellar: Discard another card (${newDiscardedCards.length} discarded so far, or skip to draw)`,
          options: [...updatedPlayer.hand],
          minCount: 0,
          maxCount: 1,
          canSkip: true,
          metadata: {
            cardBeingPlayed: "Cellar",
            discardedCards: newDiscardedCards,
          },
        },
      };
    }

    // Initial prompt (no decision yet)
    if (!decision) {
      // Auto-complete if hand is empty
      if (currentPlayer.hand.length === 0) {
        return { ...newState, pendingDecision: null };
      }

      return {
        ...newState,
        pendingDecision: {
          type: "discard",
          player: "human",
          prompt: "Cellar: Discard any number of cards (or skip)",
          options: [...currentPlayer.hand],
          minCount: 0,
          maxCount: 1,
          canSkip: true,
          metadata: {
            cardBeingPlayed: "Cellar",
            discardedCards: [],
          },
        },
      };
    }

    return newState;
  }

  // For AI: auto-discard victory cards
  const toDiscard = currentPlayer.hand.filter((c): c is "Estate" | "Duchy" | "Province" | "Curse" =>
    c === "Estate" || c === "Duchy" || c === "Province" || c === "Curse"
  );

  if (toDiscard.length > 0) {
    const newHand = currentPlayer.hand.filter(c => !toDiscard.includes(c as any));
    const { player: afterDraw, drawn } = drawCards(
      { ...currentPlayer, hand: newHand, discard: [...currentPlayer.discard, ...toDiscard] },
      toDiscard.length
    );

    newState = {
      ...newState,
      players: { ...newState.players, [player]: afterDraw },
    };
    children.push({ type: "discard-cards", player, count: toDiscard.length, cards: toDiscard });
    children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  }

  return newState;
};
