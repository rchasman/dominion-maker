import type { CardEffect } from "../card-effect";
import type { Player, CardName } from "../../types/game-state";

export const militia: CardEffect = ({ state, player, children, decision }) => {
  // +$2, each opponent discards down to 3 cards
  const opponent: Player = player === "human" ? "ai" : "human";
  const oppState = state.players[opponent];

  // Apply +$2 ONLY on initial call
  let newState = state;
  if (!decision) {
    newState = {
      ...state,
      coins: state.coins + 2,
    };
    children.push({ type: "get-coins", player, count: 2 });
  }

  // Handle opponent discard
  const cardsOverLimit = oppState.hand.length - 3;

  // No discard needed if opponent has 3 or fewer cards
  if (cardsOverLimit <= 0) {
    return { ...newState, pendingDecision: null };
  }

  // Human opponent: prompt for discard
  if (opponent === "human") {
    // Track already discarded cards
    const discardedCount = (decision?.metadata?.discardedCount as number) || 0;
    const remainingToDiscard = cardsOverLimit - discardedCount;

    // If we just made a selection, process it
    if (decision && decision.selectedCards && decision.selectedCards.length > 0) {
      const toDiscard = decision.selectedCards[0];
      const newHand = [...oppState.hand];
      const idx = newHand.indexOf(toDiscard);

      if (idx === -1) {
        console.error(`Militia: Card ${toDiscard} not found in opponent hand`);
        return newState;
      }

      // Remove from hand and add to discard
      newHand.splice(idx, 1);
      const newDiscard = [...oppState.discard, toDiscard];
      const newDiscardedCount = discardedCount + 1;

      newState = {
        ...newState,
        players: {
          ...newState.players,
          [opponent]: {
            ...oppState,
            hand: newHand,
            discard: newDiscard,
          },
        },
      };
      children.push({ type: "discard-cards", player: opponent, count: 1, cards: [toDiscard] });

      // Check if done discarding
      if (newDiscardedCount >= cardsOverLimit) {
        return { ...newState, pendingDecision: null };
      }

      // Update opponent state reference
      const updatedOppState = newState.players[opponent];

      // Prompt for next discard
      return {
        ...newState,
        pendingDecision: {
          type: "discard",
          player: opponent,
          prompt: `Militia attack: Discard ${cardsOverLimit - newDiscardedCount} more card(s) to get down to 3`,
          options: [...updatedOppState.hand],
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: {
            cardBeingPlayed: "Militia",
            discardedCount: newDiscardedCount,
            totalNeeded: cardsOverLimit,
          },
        },
      };
    }

    // Initial prompt for human opponent
    return {
      ...newState,
      pendingDecision: {
        type: "discard",
        player: opponent,
        prompt: `Militia attack: Discard ${cardsOverLimit} card(s) to get down to 3`,
        options: [...oppState.hand],
        minCount: 1,
        maxCount: 1,
        canSkip: false,
        metadata: {
          cardBeingPlayed: "Militia",
          discardedCount: 0,
          totalNeeded: cardsOverLimit,
        },
      },
    };
  }

  // AI opponent: auto-discard weakest cards (victory cards, then coppers)
  const toDiscard: CardName[] = [];
  const handCopy = [...oppState.hand];

  // Priority 1: Discard victory cards
  const victoryCards = handCopy.filter(c => c === "Estate" || c === "Duchy" || c === "Province");
  toDiscard.push(...victoryCards.slice(0, cardsOverLimit));

  // Priority 2: Discard curses
  if (toDiscard.length < cardsOverLimit) {
    const curses = handCopy.filter(c => c === "Curse");
    toDiscard.push(...curses.slice(0, cardsOverLimit - toDiscard.length));
  }

  // Priority 3: Discard coppers
  if (toDiscard.length < cardsOverLimit) {
    const coppers = handCopy.filter(c => c === "Copper");
    toDiscard.push(...coppers.slice(0, cardsOverLimit - toDiscard.length));
  }

  // Priority 4: Discard remaining cards (shouldn't happen often)
  if (toDiscard.length < cardsOverLimit) {
    const remaining = handCopy.filter(c => !toDiscard.includes(c));
    toDiscard.push(...remaining.slice(0, cardsOverLimit - toDiscard.length));
  }

  // Apply discards
  const newHand = handCopy.filter(c => {
    const idx = toDiscard.indexOf(c);
    if (idx !== -1) {
      toDiscard.splice(idx, 1);
      return false;
    }
    return true;
  });

  newState = {
    ...newState,
    players: {
      ...newState.players,
      [opponent]: {
        ...oppState,
        hand: newHand,
        discard: [...oppState.discard, ...toDiscard],
      },
    },
  };
  children.push({ type: "discard-cards", player: opponent, count: cardsOverLimit, cards: toDiscard });

  return { ...newState, pendingDecision: null };
};
