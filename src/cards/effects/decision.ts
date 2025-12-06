/**
 * Decision card effects - require player choices.
 * These cards pause for player input and resume when a decision is made.
 */

import type { CardEffect, CardEffectResult } from "../effect-types";
import { getGainableCards } from "../effect-types";
import type { GameEvent } from "../../events/types";
import { CARDS } from "../../data/cards";
import type { CardName } from "../../types/game-state";

// Gain a card costing up to $4
export const workshop: CardEffect = ({ state, player, decision }): CardEffectResult => {
  // Stage 1: Request gain choice
  if (!decision) {
    const gainOptions = getGainableCards(state, 4);
    if (gainOptions.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "supply",
        prompt: "Workshop: Gain a card costing up to $4",
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        stage: "gain",
      },
    };
  }

  // Stage 2: Execute gain
  const gained = decision.selectedCards[0];
  if (!gained) return { events: [] };

  return {
    events: [{ type: "CARD_GAINED", player, card: gained, to: "discard" }],
  };
};

// Trash a card from hand, gain a card costing up to $2 more
export const remodel: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];

  // Stage 1: Choose card to trash
  if (!decision || stage === undefined) {
    if (playerState.hand.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Remodel: Choose a card to trash",
        cardOptions: [...playerState.hand],
        min: 1,
        max: 1,
        stage: "trash",
      },
    };
  }

  // Stage 2: Trash chosen, now choose gain
  if (stage === "trash") {
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const trashCost = CARDS[toTrash].cost;
    const maxCost = trashCost + 2;
    const gainOptions = getGainableCards(state, maxCost);

    const events: GameEvent[] = [
      { type: "CARDS_TRASHED", player, cards: [toTrash], from: "hand" },
    ];

    if (gainOptions.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "supply",
        prompt: `Remodel: Gain a card costing up to $${maxCost}`,
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        stage: "gain",
        metadata: { trashedCard: toTrash, maxCost },
      },
    };
  }

  // Stage 3: Execute gain
  if (stage === "gain") {
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "discard" }],
    };
  }

  return { events: [] };
};

// Gain a card costing up to $5, put it on top of your deck
export const artisan: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];

  // Stage 1: Choose card to gain
  if (!decision || stage === undefined) {
    const gainOptions = getGainableCards(state, 5);
    if (gainOptions.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "supply",
        prompt: "Artisan: Gain a card costing up to $5 to your hand",
        cardOptions: gainOptions,
        min: 1,
        max: 1,
        stage: "gain",
      },
    };
  }

  // Stage 2: Gain to hand, then choose card to put on deck
  if (stage === "gain") {
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    // Gain to hand, then must put a card from hand on deck
    // Note: hand now includes the gained card
    const handAfterGain = [...playerState.hand, gained];

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "hand" }],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Artisan: Put a card from your hand onto your deck",
        cardOptions: handAfterGain,
        min: 1,
        max: 1,
        stage: "topdeck",
      },
    };
  }

  // Stage 3: Put card on deck
  if (stage === "topdeck") {
    const toPutOnDeck = decision.selectedCards[0];
    if (!toPutOnDeck) return { events: [] };

    return {
      events: [{ type: "CARDS_PUT_ON_DECK", player, cards: [toPutOnDeck], from: "hand" }],
    };
  }

  return { events: [] };
};

// Trash up to 4 cards from your hand
export const chapel: CardEffect = ({ state, player, decision }): CardEffectResult => {
  const playerState = state.players[player];

  // Request trash choice
  if (!decision) {
    if (playerState.hand.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Chapel: Trash up to 4 cards from your hand",
        cardOptions: [...playerState.hand],
        min: 0,
        max: Math.min(4, playerState.hand.length),
        stage: "trash",
      },
    };
  }

  // Execute trash
  const toTrash = decision.selectedCards;
  if (toTrash.length === 0) return { events: [] };

  return {
    events: [{ type: "CARDS_TRASHED", player, cards: toTrash, from: "hand" }],
  };
};

// Trash a Copper from your hand for +$3
export const moneylender: CardEffect = ({ state, player, decision }): CardEffectResult => {
  const playerState = state.players[player];
  const hasCopperInHand = playerState.hand.includes("Copper");

  if (!hasCopperInHand) return { events: [] };

  // Request confirmation (or auto-trash for AI)
  if (!decision) {
    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Moneylender: Trash a Copper for +$3?",
        cardOptions: ["Copper"],
        min: 0,
        max: 1,
        stage: "trash",
      },
    };
  }

  // Execute trash + coins
  if (decision.selectedCards.includes("Copper")) {
    return {
      events: [
        { type: "CARDS_TRASHED", player, cards: ["Copper"], from: "hand" },
        { type: "COINS_MODIFIED", delta: 3 },
      ],
    };
  }

  return { events: [] };
};

// Trash a Treasure from hand, gain a Treasure costing up to $3 more to hand
export const mine: CardEffect = ({ state, player, decision, stage }): CardEffectResult => {
  const playerState = state.players[player];

  // Stage 1: Choose treasure to trash
  if (!decision || stage === undefined) {
    const treasures = playerState.hand.filter(
      c => CARDS[c].types.includes("treasure")
    );
    if (treasures.length === 0) return { events: [] };

    return {
      events: [],
      pendingDecision: {
        type: "select_cards",
        player,
        from: "hand",
        prompt: "Mine: Trash a Treasure from your hand",
        cardOptions: treasures,
        min: 1,
        max: 1,
        stage: "trash",
      },
    };
  }

  // Stage 2: Choose treasure to gain
  if (stage === "trash") {
    const toTrash = decision.selectedCards[0];
    if (!toTrash) return { events: [] };

    const trashCost = CARDS[toTrash].cost;
    const maxCost = trashCost + 3;

    // Find gainable treasures
    const gainableTreasures = Object.entries(state.supply)
      .filter(([card, count]) => {
        const cardDef = CARDS[card as CardName];
        return count > 0 &&
          cardDef.types.includes("treasure") &&
          cardDef.cost <= maxCost;
      })
      .map(([card]) => card as CardName);

    const events: GameEvent[] = [
      { type: "CARDS_TRASHED", player, cards: [toTrash], from: "hand" },
    ];

    if (gainableTreasures.length === 0) {
      return { events };
    }

    return {
      events,
      pendingDecision: {
        type: "select_cards",
        player,
        from: "supply",
        prompt: `Mine: Gain a Treasure costing up to $${maxCost} to your hand`,
        cardOptions: gainableTreasures,
        min: 1,
        max: 1,
        stage: "gain",
      },
    };
  }

  // Stage 3: Gain to hand
  if (stage === "gain") {
    const gained = decision.selectedCards[0];
    if (!gained) return { events: [] };

    return {
      events: [{ type: "CARD_GAINED", player, card: gained, to: "hand" }],
    };
  }

  return { events: [] };
};
