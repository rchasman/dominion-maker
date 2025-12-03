import type { CardEffect } from "../card-effect";

export const chapel: CardEffect = ({ state, player, children, decision }) => {
  // Trash up to 4 cards from hand
  const currentPlayer = state.players[player];

  // For human players, iterative trash decisions
  if (player === "human") {
    // Track how many cards have been trashed so far
    const trashedCount = (decision && typeof decision.stage === "string")
      ? parseInt(decision.stage) || 0
      : 0;

    // Stage N: Choose card to trash (or skip if done)
    if (!decision || trashedCount < 4) {
      // If we just trashed a card, process it first
      if (decision && decision.selectedCards && decision.selectedCards.length > 0) {
        const toTrash = decision.selectedCards[0];
        const newHand = [...currentPlayer.hand];
        const idx = newHand.indexOf(toTrash);
        if (idx !== -1) newHand.splice(idx, 1);

        const newState = {
          ...state,
          players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
          trash: [...state.trash, toTrash],
        };
        children.push({ type: "trash-cards", player, count: 1, cards: [toTrash] });

        // Continue to next iteration
        const newTrashedCount = trashedCount + 1;
        const updatedPlayer = newState.players[player];

        if (newTrashedCount < 4 && updatedPlayer.hand.length > 0) {
          return {
            ...newState,
            pendingDecision: {
              type: "trash",
              player: "human",
              prompt: `Chapel: Trash up to ${4 - newTrashedCount} more cards (or skip)`,
              options: [...updatedPlayer.hand],
              minCount: 0,
              maxCount: 1,
              canSkip: true,
              metadata: { cardBeingPlayed: "Chapel", stage: newTrashedCount.toString() },
            },
          };
        }

        // Done trashing (reached 4 or no more cards)
        return { ...newState, pendingDecision: null };
      }

      // Initial prompt
      if (currentPlayer.hand.length === 0) return state;

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
          metadata: { cardBeingPlayed: "Chapel", stage: "0" },
        },
      };
    }

    return state;
  }

  // For AI: auto-trash Curses and Coppers (up to 4)
  const toTrash = currentPlayer.hand
    .filter(c => c === "Curse" || c === "Copper")
    .slice(0, 4);

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
    children.push({ type: "trash-cards", player, count: toTrash.length, cards: toTrash });
    return newState;
  }

  return state;
};
