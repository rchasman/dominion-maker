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
    return { ...newState, subPhase: null, pendingDecision: null };
  }

  // Track already discarded cards
  const discardedCount = (decision?.metadata?.discardedCount as number) || 0;

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
      return { ...newState, subPhase: null, pendingDecision: null };
    }

    // Update opponent state reference
    const updatedOppState = newState.players[opponent];

    // Prompt for next discard
    return {
      ...newState,
      subPhase: "opponent_decision",
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

  // Initial prompt for opponent (human or AI)
  return {
    ...newState,
    subPhase: "opponent_decision",
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
};
