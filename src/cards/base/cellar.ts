import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";

export const cellar: CardEffect = ({ state, player, children, decision }) => {
  // +1 Action. Discard any number, draw that many
  const currentPlayer = state.players[player];

  let newState = {
    ...state,
    actions: state.actions + 1,
  };
  children.push({ type: "get-actions", player, count: 1 });

  // For human players, iterative discard decisions
  if (player === "human") {
    // Track discarded cards
    const discardedCards: string[] = (decision && decision.stage && decision.stage !== "initial")
      ? decision.stage.split(",").filter(c => c)
      : [];

    // If we just discarded a card, process it
    if (decision && decision.selectedCards && decision.selectedCards.length > 0 && decision.stage !== "initial") {
      const toDiscard = decision.selectedCards[0];
      const newHand = [...currentPlayer.hand];
      const idx = newHand.indexOf(toDiscard);
      if (idx !== -1) newHand.splice(idx, 1);

      const newDiscard = [...currentPlayer.discard, toDiscard];
      discardedCards.push(toDiscard);

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

      // Prompt for more discards if hand still has cards
      if (updatedPlayer.hand.length > 0) {
        return {
          ...newState,
          pendingDecision: {
            type: "discard",
            player: "human",
            prompt: `Cellar: Discard another card (${discardedCards.length} discarded so far, or skip to draw)`,
            options: [...updatedPlayer.hand],
            minCount: 0,
            maxCount: 1,
            canSkip: true,
            metadata: { cardBeingPlayed: "Cellar", stage: discardedCards.join(",") },
          },
        };
      }

      // No more cards to discard, draw cards
      const { player: afterDraw, drawn } = drawCards(updatedPlayer, discardedCards.length);
      newState = {
        ...newState,
        players: { ...newState.players, [player]: afterDraw },
        pendingDecision: null,
      };
      children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      return newState;
    }

    // Initial or skip (draw cards and finish)
    if (decision && decision.selectedCards && decision.selectedCards.length === 0) {
      // Skipped - draw cards equal to discarded count
      if (discardedCards.length > 0) {
        const { player: afterDraw, drawn } = drawCards(currentPlayer, discardedCards.length);
        newState = {
          ...newState,
          players: { ...newState.players, [player]: afterDraw },
          pendingDecision: null,
        };
        children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
      }
      return { ...newState, pendingDecision: null };
    }

    // Initial prompt
    if (!decision && currentPlayer.hand.length > 0) {
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
          metadata: { cardBeingPlayed: "Cellar", stage: "initial" },
        },
      };
    }

    return newState;
  }

  // For AI: auto-discard victory cards
  const toDiscard = currentPlayer.hand.filter(c =>
    c === "Estate" || c === "Duchy" || c === "Province" || c === "Curse"
  );

  if (toDiscard.length > 0) {
    const newHand = currentPlayer.hand.filter(c => !toDiscard.includes(c));
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
