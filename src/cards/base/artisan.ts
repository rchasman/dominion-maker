import type { CardEffect } from "../card-effect";
import type { CardName } from "../../types/game-state";
import { CARDS } from "../../data/cards";

export const artisan: CardEffect = ({ state, player, children, decision }) => {
  // Gain card to hand (up to $5). Put a card from hand onto deck
  const currentPlayer = state.players[player];

  // For human players, use multi-stage decision
  if (player === "human") {
    // Stage 1: Choose card to gain (up to $5)
    if (!decision) {
      const gainOptions: CardName[] = [];
      for (const [card, count] of Object.entries(state.supply)) {
        if (count > 0 && CARDS[card as CardName].cost <= 5) {
          gainOptions.push(card as CardName);
        }
      }

      if (gainOptions.length === 0) return state;

      return {
        ...state,
        pendingDecision: {
          type: "gain",
          player: "human",
          prompt: "Artisan: Gain a card costing up to $5 to your hand",
          options: gainOptions,
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: { cardBeingPlayed: "Artisan", stage: "gain" },
        },
      };
    }

    // Stage 2: Card gained to hand, now choose card to topdeck
    if (decision.stage === "gain" && decision.selectedCards && decision.selectedCards.length > 0) {
      const gained = decision.selectedCards[0];

      const newState = {
        ...state,
        players: {
          ...state.players,
          [player]: {
            ...currentPlayer,
            hand: [...currentPlayer.hand, gained],
          },
        },
        supply: {
          ...state.supply,
          [gained]: state.supply[gained] - 1,
        },
      };
      children.push({ type: "gain-card", player, card: gained });

      // Now prompt to topdeck a card from the updated hand
      const updatedPlayer = newState.players[player];

      return {
        ...newState,
        pendingDecision: {
          type: "choose_card_from_options",
          player: "human",
          prompt: "Artisan: Put a card from your hand onto your deck",
          options: [...updatedPlayer.hand],
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: { cardBeingPlayed: "Artisan", stage: "topdeck" },
        },
      };
    }

    // Stage 3: Topdeck the chosen card
    if (decision.stage === "topdeck" && decision.selectedCards && decision.selectedCards.length > 0) {
      const toPutBack = decision.selectedCards[0];
      const newHand = [...currentPlayer.hand];
      const idx = newHand.indexOf(toPutBack);
      if (idx === -1) return state;

      newHand.splice(idx, 1);

      const newState = {
        ...state,
        pendingDecision: null,
        players: {
          ...state.players,
          [player]: {
            ...currentPlayer,
            hand: newHand,
            deck: [toPutBack, ...currentPlayer.deck],
          },
        },
      };
      children.push({ type: "text", message: `Put ${toPutBack} on deck` });
      return newState;
    }

    return state;
  }

  // For AI: auto-choose
  const options: CardName[] = ["Silver", "Smithy", "Market", "Village"];
  let gained: CardName | null = null;

  for (const option of options) {
    if (state.supply[option] > 0 && CARDS[option].cost <= 5) {
      gained = option;
      break;
    }
  }

  if (gained) {
    let newState = {
      ...state,
      players: {
        ...state.players,
        [player]: {
          ...currentPlayer,
          hand: [...currentPlayer.hand, gained],
        },
      },
      supply: {
        ...state.supply,
        [gained]: state.supply[gained] - 1,
      },
    };
    children.push({ type: "gain-card", player, card: gained });

    // Put a card from hand onto deck (worst card: Curse/Copper/Estate)
    const updatedPlayer = newState.players[player];
    const toPutBack = updatedPlayer.hand.find(c => c === "Curse") ||
                      updatedPlayer.hand.find(c => c === "Copper") ||
                      updatedPlayer.hand.find(c => c === "Estate") ||
                      updatedPlayer.hand[0];

    if (toPutBack) {
      const newHand = [...updatedPlayer.hand];
      const idx = newHand.indexOf(toPutBack);
      newHand.splice(idx, 1);

      newState = {
        ...newState,
        players: {
          ...newState.players,
          [player]: {
            ...updatedPlayer,
            hand: newHand,
            deck: [toPutBack, ...updatedPlayer.deck],
          },
        },
      };
      children.push({ type: "text", message: `Put ${toPutBack} on deck` });
    }

    return newState;
  }

  return state;
};
