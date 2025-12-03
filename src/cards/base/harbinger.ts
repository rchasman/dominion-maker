import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";
import { isActionCard } from "../../data/cards";

export const harbinger: CardEffect = ({ state, player, children, decision }) => {
  // +1 Card, +1 Action. May put a card from discard onto deck
  const { player: newPlayer, drawn } = drawCards(state.players[player], 1);
  const currentPlayer = newPlayer;

  let newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
    actions: state.actions + 1,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-actions", player, count: 1 });

  // For human players, prompt to choose from discard (optional)
  if (player === "human") {
    if (!decision && currentPlayer.discard.length > 0) {
      return {
        ...newState,
        pendingDecision: {
          type: "choose_card_from_options",
          player: "human",
          prompt: "Harbinger: Put a card from discard onto your deck (or skip)",
          options: [...currentPlayer.discard],
          minCount: 0,
          maxCount: 1,
          canSkip: true,
          metadata: { cardBeingPlayed: "Harbinger", stage: "topdeck" },
        },
      };
    }

    // Topdeck chosen card
    if (decision && decision.selectedCards && decision.selectedCards.length > 0) {
      const toTopdeck = decision.selectedCards[0];
      const newDiscard = currentPlayer.discard.filter((c, i) =>
        i !== currentPlayer.discard.indexOf(toTopdeck)
      );

      newState = {
        ...newState,
        pendingDecision: null,
        players: {
          ...newState.players,
          [player]: {
            ...currentPlayer,
            deck: [toTopdeck, ...currentPlayer.deck],
            discard: newDiscard,
          },
        },
      };
      children.push({ type: "text", message: `Put ${toTopdeck} on deck` });
      return newState;
    }

    return newState;
  }

  // For AI: auto-choose best card from discard
  if (currentPlayer.discard.length > 0) {
    const bestCard = currentPlayer.discard.find(c => isActionCard(c)) || currentPlayer.discard[0];
    const newDiscard = currentPlayer.discard.filter((c, i) =>
      i !== currentPlayer.discard.indexOf(bestCard)
    );

    newState = {
      ...newState,
      players: {
        ...newState.players,
        [player]: {
          ...currentPlayer,
          deck: [bestCard, ...currentPlayer.deck],
          discard: newDiscard,
        },
      },
    };
    children.push({ type: "text", message: `Put ${bestCard} on deck` });
  }

  return newState;
};
