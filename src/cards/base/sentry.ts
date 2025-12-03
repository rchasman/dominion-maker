import type { CardEffect } from "../card-effect";
import { drawCards, shuffle } from "../../lib/game-utils";
import type { CardName } from "../../types/game-state";

export const sentry: CardEffect = ({ state, player, children, decision }) => {
  // +1 Card, +1 Action. Look at top 2, trash/discard/put back any
  const { player: newPlayer, drawn } = drawCards(state.players[player], 1);

  let currentPlayer = newPlayer;
  let deck = [...currentPlayer.deck];
  let discard = [...currentPlayer.discard];

  // Shuffle if needed
  if (deck.length < 2 && discard.length > 0) {
    deck = [...deck, ...shuffle(discard)];
    discard = [];
  }

  const top2 = [deck[0], deck[1]].filter(c => c !== undefined) as CardName[];

  let newState = {
    ...state,
    players: { ...state.players, [player]: newPlayer },
    actions: state.actions + 1,
  };
  children.push({ type: "draw-cards", player, count: drawn.length, cards: drawn });
  children.push({ type: "get-actions", player, count: 1 });

  // For human players, let them choose what to do with each card
  if (player === "human" && top2.length > 0) {
    // Parse the decisions made so far
    const decisions: Record<string, "trash" | "discard" | "keep"> = {};
    if (decision && decision.stage && decision.stage !== "initial") {
      const parts = decision.stage.split(";");
      for (const part of parts) {
        if (part) {
          const [card, action] = part.split(":");
          if (card && action) {
            decisions[card] = action as "trash" | "discard" | "keep";
          }
        }
      }
    }

    // Find next card to decide on
    const cardToDecide = top2.find(c => !decisions[c]);

    if (cardToDecide) {
      // Prompt for decision on this card
      return {
        ...newState,
        pendingDecision: {
          type: "choose_card_from_options",
          player: "human",
          prompt: `Sentry: What to do with ${cardToDecide}? (Viewing: ${top2.join(", ")})`,
          options: ["Trash", "Discard", "Keep on top"],
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: {
            cardBeingPlayed: "Sentry",
            stage: Object.entries(decisions).map(([c, a]) => `${c}:${a}`).join(";"),
            sentryCard: cardToDecide,
            sentryTop2: top2,
          },
        },
      };
    }

    // All decisions made, execute them
    if (Object.keys(decisions).length === top2.length) {
      for (const [card, action] of Object.entries(decisions)) {
        const idx = deck.indexOf(card as CardName);
        if (idx !== -1) {
          deck.splice(idx, 1);
          if (action === "trash") {
            newState = { ...newState, trash: [...newState.trash, card as CardName] };
            children.push({ type: "text", message: `Trashed ${card}` });
          } else if (action === "discard") {
            discard.push(card as CardName);
            children.push({ type: "text", message: `Discarded ${card}` });
          } else {
            // Keep - put back on top
            deck.unshift(card as CardName);
            children.push({ type: "text", message: `Kept ${card} on top` });
          }
        }
      }

      newState = {
        ...newState,
        pendingDecision: null,
        players: {
          ...newState.players,
          [player]: {
            ...currentPlayer,
            deck,
            discard,
          },
        },
      };
      return newState;
    }

    // Record the decision for this card
    if (decision && decision.selectedCards && decision.selectedCards.length > 0 && decision.metadata) {
      const choice = decision.selectedCards[0];
      const sentryCard = (decision.metadata as any).sentryCard;

      let action: "trash" | "discard" | "keep";
      if (choice === "Trash") action = "trash";
      else if (choice === "Discard") action = "discard";
      else action = "keep";

      decisions[sentryCard] = action;

      // Find next card to decide on
      const nextCard = top2.find(c => !decisions[c]);

      if (nextCard) {
        // More cards to decide
        return {
          ...newState,
          pendingDecision: {
            type: "choose_card_from_options",
            player: "human",
            prompt: `Sentry: What to do with ${nextCard}? (Viewing: ${top2.join(", ")})`,
            options: ["Trash", "Discard", "Keep on top"],
            minCount: 1,
            maxCount: 1,
            canSkip: false,
            metadata: {
              cardBeingPlayed: "Sentry",
              stage: Object.entries(decisions).map(([c, a]) => `${c}:${a}`).join(";"),
              sentryCard: nextCard,
              sentryTop2: top2,
            },
          },
        };
      }

      // All decisions made, execute
      for (const [card, action] of Object.entries(decisions)) {
        const idx = deck.indexOf(card as CardName);
        if (idx !== -1) {
          deck.splice(idx, 1);
          if (action === "trash") {
            newState = { ...newState, trash: [...newState.trash, card as CardName] };
            children.push({ type: "text", message: `Trashed ${card}` });
          } else if (action === "discard") {
            discard.push(card as CardName);
            children.push({ type: "text", message: `Discarded ${card}` });
          } else {
            // Keep - put back on top
            deck.unshift(card as CardName);
            children.push({ type: "text", message: `Kept ${card} on top` });
          }
        }
      }

      newState = {
        ...newState,
        pendingDecision: null,
        players: {
          ...newState.players,
          [player]: {
            ...currentPlayer,
            deck,
            discard,
          },
        },
      };
      return newState;
    }

    return newState;
  }

  // For AI: auto-trash Curses, discard Coppers/Estates, keep others
  for (const card of top2) {
    const idx = deck.indexOf(card);
    if (card === "Curse") {
      deck.splice(idx, 1);
      newState = { ...newState, trash: [...newState.trash, card] };
      children.push({ type: "text", message: `Trashed ${card}` });
    } else if (card === "Copper" || card === "Estate") {
      deck.splice(idx, 1);
      discard.push(card);
      children.push({ type: "text", message: `Discarded ${card}` });
    }
    // Otherwise keep on top of deck
  }

  newState = {
    ...newState,
    players: {
      ...newState.players,
      [player]: {
        ...currentPlayer,
        deck,
        discard,
      },
    },
  };

  return newState;
};
