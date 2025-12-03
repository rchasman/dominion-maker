import type { CardEffect } from "../card-effect";
import { drawCards } from "../../lib/game-utils";
import { isActionCard } from "../../data/cards";
import type { CardName } from "../../types/game-state";

export const library: CardEffect = ({ state, player, children, decision }) => {
  // Draw until 7 cards, may skip Actions (discard after)
  const currentPlayer = state.players[player];

  // For human players, iterative draw with decision for each action
  if (player === "human") {
    // Parse set-aside cards from stage
    const setAside: CardName[] = (decision && decision.stage && decision.stage !== "initial")
      ? (decision.stage.split(",").filter(c => c) as CardName[])
      : [];

    // If we just made a decision about an action card
    if (decision && decision.metadata && (decision.metadata as any).drawnCard) {
      const drawnCard = (decision.metadata as any).drawnCard as CardName;
      const choice = decision.selectedCards && decision.selectedCards.length > 0 ? decision.selectedCards[0] : "Skip";

      if (choice === "Skip") {
        // Set aside this action
        setAside.push(drawnCard);
        // Remove from hand
        const newHand = [...currentPlayer.hand];
        const idx = newHand.lastIndexOf(drawnCard);
        if (idx !== -1) newHand.splice(idx, 1);

        const updatedPlayer = {
          ...currentPlayer,
          hand: newHand,
        };

        children.push({ type: "text", message: `Set aside ${drawnCard}` });

        // Check if we should continue
        if (updatedPlayer.hand.length >= 7) {
          // Done - discard set-aside cards
          const newState = {
            ...state,
            pendingDecision: null,
            players: {
              ...state.players,
              [player]: {
                ...updatedPlayer,
                discard: [...updatedPlayer.discard, ...setAside],
              },
            },
          };
          if (setAside.length > 0) {
            children.push({ type: "discard-cards", player, count: setAside.length, cards: setAside });
          }
          return newState;
        }

        // Continue drawing
        const { player: afterDraw, drawn } = drawCards(updatedPlayer, 1);
        if (drawn.length === 0) {
          // No more cards - finish
          const newState = {
            ...state,
            pendingDecision: null,
            players: {
              ...state.players,
              [player]: {
                ...afterDraw,
                discard: [...afterDraw.discard, ...setAside],
              },
            },
          };
          if (setAside.length > 0) {
            children.push({ type: "discard-cards", player, count: setAside.length, cards: setAside });
          }
          return newState;
        }

        const nextCard = drawn[0];
        children.push({ type: "draw-cards", player, count: 1, cards: drawn });

        if (isActionCard(nextCard) && afterDraw.hand.length < 7) {
          // Prompt for next action card
          return {
            ...state,
            players: { ...state.players, [player]: afterDraw },
            pendingDecision: {
              type: "choose_card_from_options",
              player: "human",
              prompt: `Library: Drew ${nextCard}. Keep it or skip it?`,
              options: ["Keep", "Skip"],
              minCount: 1,
              maxCount: 1,
              canSkip: false,
              metadata: {
                cardBeingPlayed: "Library",
                stage: setAside.join(","),
                drawnCard: nextCard,
              },
            },
          };
        }

        // Non-action or reached 7, continue
        return library({
          state: { ...state, players: { ...state.players, [player]: afterDraw } },
          player,
          children,
          decision: { stage: setAside.join(","), selectedCards: [] },
        });
      } else {
        // Keep - continue drawing
        if (currentPlayer.hand.length >= 7) {
          // Done
          const newState = {
            ...state,
            pendingDecision: null,
            players: {
              ...state.players,
              [player]: {
                ...currentPlayer,
                discard: [...currentPlayer.discard, ...setAside],
              },
            },
          };
          if (setAside.length > 0) {
            children.push({ type: "discard-cards", player, count: setAside.length, cards: setAside });
          }
          return newState;
        }

        const { player: afterDraw, drawn } = drawCards(currentPlayer, 1);
        if (drawn.length === 0) {
          // No more cards
          const newState = {
            ...state,
            pendingDecision: null,
            players: {
              ...state.players,
              [player]: {
                ...afterDraw,
                discard: [...afterDraw.discard, ...setAside],
              },
            },
          };
          if (setAside.length > 0) {
            children.push({ type: "discard-cards", player, count: setAside.length, cards: setAside });
          }
          return newState;
        }

        const nextCard = drawn[0];
        children.push({ type: "draw-cards", player, count: 1, cards: drawn });

        if (isActionCard(nextCard) && afterDraw.hand.length < 7) {
          return {
            ...state,
            players: { ...state.players, [player]: afterDraw },
            pendingDecision: {
              type: "choose_card_from_options",
              player: "human",
              prompt: `Library: Drew ${nextCard}. Keep it or skip it?`,
              options: ["Keep", "Skip"],
              minCount: 1,
              maxCount: 1,
              canSkip: false,
              metadata: {
                cardBeingPlayed: "Library",
                stage: setAside.join(","),
                drawnCard: nextCard,
              },
            },
          };
        }

        // Continue
        return library({
          state: { ...state, players: { ...state.players, [player]: afterDraw } },
          player,
          children,
          decision: { stage: setAside.join(","), selectedCards: [] },
        });
      }
    }

    // Initial draw
    if (!decision || decision.stage === "initial") {
      if (currentPlayer.hand.length >= 7) return state;

      const { player: afterDraw, drawn } = drawCards(currentPlayer, 1);
      if (drawn.length === 0) return state;

      const drawnCard = drawn[0];
      children.push({ type: "draw-cards", player, count: 1, cards: drawn });

      if (isActionCard(drawnCard) && afterDraw.hand.length < 7) {
        // Prompt for action card
        return {
          ...state,
          players: { ...state.players, [player]: afterDraw },
          pendingDecision: {
            type: "choose_card_from_options",
            player: "human",
            prompt: `Library: Drew ${drawnCard}. Keep it or skip it?`,
            options: ["Keep", "Skip"],
            minCount: 1,
            maxCount: 1,
            canSkip: false,
            metadata: {
              cardBeingPlayed: "Library",
              stage: "initial",
              drawnCard,
            },
          },
        };
      }

      // Non-action, continue
      return library({
        state: { ...state, players: { ...state.players, [player]: afterDraw } },
        player,
        children,
        decision: { stage: "", selectedCards: [] },
      });
    }

    return state;
  }

  // For AI: auto-skip action cards
  let aiPlayer = currentPlayer;

  while (aiPlayer.hand.length < 7) {
    const { player: afterDraw, drawn } = drawCards(aiPlayer, 1);
    if (drawn.length === 0) break;

    const drawnCard = drawn[0];
    if (isActionCard(drawnCard)) {
      // Skip action cards (put in discard)
      aiPlayer = {
        ...afterDraw,
        hand: afterDraw.hand.slice(0, -1),
        discard: [...afterDraw.discard, drawnCard],
      };
      children.push({ type: "text", message: `Skipped ${drawnCard}` });
    } else {
      aiPlayer = afterDraw;
      children.push({ type: "draw-cards", player, count: 1, cards: drawn });
    }
  }

  const newState = {
    ...state,
    players: { ...state.players, [player]: aiPlayer },
  };

  return newState;
};
