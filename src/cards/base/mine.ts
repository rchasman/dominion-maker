import type { CardEffect } from "../card-effect";
import type { CardName } from "../../types/game-state";
import { CARDS } from "../../data/cards";

export const mine: CardEffect = ({ state, player, children, decision }) => {
  // Trash Treasure, gain Treasure costing up to $3 more to hand
  const currentPlayer = state.players[player];

  // For human players, use multi-stage decision
  if (player === "human") {
    // Stage 1: Choose treasure to trash
    if (!decision) {
      const treasures = currentPlayer.hand.filter(c => c === "Copper" || c === "Silver" || c === "Gold");
      if (treasures.length === 0) return state;

      return {
        ...state,
        pendingDecision: {
          type: "trash",
          player: "human",
          prompt: "Mine: Choose a treasure to trash",
          options: treasures,
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: { cardBeingPlayed: "Mine", stage: "trash" },
        },
      };
    }

    // Stage 2: Treasure trashed, choose treasure to gain
    if (decision.stage === "trash" && decision.selectedCards && decision.selectedCards.length > 0) {
      const toTrash = decision.selectedCards[0];
      const newHand = [...currentPlayer.hand];
      const idx = newHand.indexOf(toTrash);
      if (idx === -1) return state;

      newHand.splice(idx, 1);

      const trashCost = CARDS[toTrash].cost;
      const maxCost = trashCost + 3;

      // Find all treasures we can gain
      const gainOptions: CardName[] = [];
      if (state.supply.Gold > 0 && CARDS.Gold.cost <= maxCost) gainOptions.push("Gold");
      if (state.supply.Silver > 0 && CARDS.Silver.cost <= maxCost) gainOptions.push("Silver");
      if (state.supply.Copper > 0 && CARDS.Copper.cost <= maxCost) gainOptions.push("Copper");

      const newState = {
        ...state,
        players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
        trash: [...state.trash, toTrash],
      };
      children.push({ type: "trash-cards", player, count: 1, cards: [toTrash] });

      if (gainOptions.length === 0) return newState;

      return {
        ...newState,
        pendingDecision: {
          type: "gain",
          player: "human",
          prompt: `Mine: Gain a treasure costing up to $${maxCost}`,
          options: gainOptions,
          minCount: 1,
          maxCount: 1,
          canSkip: false,
          metadata: { cardBeingPlayed: "Mine", stage: "gain" },
        },
      };
    }

    // Stage 3: Gain treasure to hand
    if (decision.stage === "gain" && decision.selectedCards && decision.selectedCards.length > 0) {
      const gained = decision.selectedCards[0];

      const newState = {
        ...state,
        pendingDecision: null,
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
      return newState;
    }

    return state;
  }

  // For AI: auto-choose
  const treasureToTrash = currentPlayer.hand.find(c => c === "Copper") ||
                          currentPlayer.hand.find(c => c === "Silver") ||
                          currentPlayer.hand.find(c => c === "Gold");

  if (treasureToTrash) {
    const newHand = [...currentPlayer.hand];
    const idx = newHand.indexOf(treasureToTrash);
    newHand.splice(idx, 1);

    const trashCost = CARDS[treasureToTrash].cost;
    const maxCost = trashCost + 3;

    // Gain best treasure up to maxCost (Gold > Silver > Copper)
    let gained: CardName | null = null;
    if (state.supply.Gold > 0 && CARDS.Gold.cost <= maxCost) {
      gained = "Gold";
    } else if (state.supply.Silver > 0 && CARDS.Silver.cost <= maxCost) {
      gained = "Silver";
    } else if (state.supply.Copper > 0 && CARDS.Copper.cost <= maxCost) {
      gained = "Copper";
    }

    let newState = {
      ...state,
      players: { ...state.players, [player]: { ...currentPlayer, hand: newHand } },
      trash: [...state.trash, treasureToTrash],
    };
    children.push({ type: "trash-cards", player, count: 1, cards: [treasureToTrash] });

    if (gained) {
      // Gain to hand (not discard)
      newState = {
        ...newState,
        players: {
          ...newState.players,
          [player]: {
            ...newState.players[player],
            hand: [...newState.players[player].hand, gained],
          },
        },
        supply: {
          ...newState.supply,
          [gained]: newState.supply[gained] - 1,
        },
      };
      children.push({ type: "gain-card", player, card: gained });
    }

    return newState;
  }

  return state;
};
