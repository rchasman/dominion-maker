import type { CardName } from "../types/game-state";

export type CardType = "treasure" | "victory" | "curse" | "action" | "attack" | "reaction";

export interface CardDefinition {
  name: CardName;
  cost: number;
  types: CardType[];
  description: string;
  // For treasure cards
  coins?: number;
  // For victory cards
  vp?: number | "variable";
}

export const CARDS: Record<CardName, CardDefinition> = {
  // Treasures
  Copper: {
    name: "Copper",
    cost: 0,
    types: ["treasure"],
    description: "+$1",
    coins: 1,
  },
  Silver: {
    name: "Silver",
    cost: 3,
    types: ["treasure"],
    description: "+$2",
    coins: 2,
  },
  Gold: {
    name: "Gold",
    cost: 6,
    types: ["treasure"],
    description: "+$3",
    coins: 3,
  },

  // Victory
  Estate: {
    name: "Estate",
    cost: 2,
    types: ["victory"],
    description: "1 VP",
    vp: 1,
  },
  Duchy: {
    name: "Duchy",
    cost: 5,
    types: ["victory"],
    description: "3 VP",
    vp: 3,
  },
  Province: {
    name: "Province",
    cost: 8,
    types: ["victory"],
    description: "6 VP",
    vp: 6,
  },

  // Curse
  Curse: {
    name: "Curse",
    cost: 0,
    types: ["curse"],
    description: "-1 VP",
    vp: -1,
  },

  // Kingdom cards - Cost $2
  Cellar: {
    name: "Cellar",
    cost: 2,
    types: ["action"],
    description: "+1 Action. Discard any number of cards, then draw that many.",
  },
  Chapel: {
    name: "Chapel",
    cost: 2,
    types: ["action"],
    description: "Trash up to 4 cards from your hand.",
  },
  Moat: {
    name: "Moat",
    cost: 2,
    types: ["action", "reaction"],
    description:
      "+2 Cards. When another player plays an Attack card, you may first reveal this from your hand, to be unaffected by it.",
  },

  // Cost $3
  Harbinger: {
    name: "Harbinger",
    cost: 3,
    types: ["action"],
    description:
      "+1 Card, +1 Action. Look through your discard pile. You may put a card from it onto your deck.",
  },
  Merchant: {
    name: "Merchant",
    cost: 3,
    types: ["action"],
    description: "+1 Card, +1 Action. The first time you play a Silver this turn, +$1.",
  },
  Vassal: {
    name: "Vassal",
    cost: 3,
    types: ["action"],
    description:
      "+$2. Discard the top card of your deck. If it's an Action card, you may play it.",
  },
  Village: {
    name: "Village",
    cost: 3,
    types: ["action"],
    description: "+1 Card, +2 Actions.",
  },
  Workshop: {
    name: "Workshop",
    cost: 3,
    types: ["action"],
    description: "Gain a card costing up to $4.",
  },

  // Cost $4
  Bureaucrat: {
    name: "Bureaucrat",
    cost: 4,
    types: ["action", "attack"],
    description:
      "Gain a Silver onto your deck. Each other player reveals a Victory card from their hand and puts it onto their deck (or reveals a hand with no Victory cards).",
  },
  Gardens: {
    name: "Gardens",
    cost: 4,
    types: ["victory"],
    description: "Worth 1 VP per 10 cards you have (round down).",
    vp: "variable",
  },
  Militia: {
    name: "Militia",
    cost: 4,
    types: ["action", "attack"],
    description: "+$2. Each other player discards down to 3 cards in hand.",
  },
  Moneylender: {
    name: "Moneylender",
    cost: 4,
    types: ["action"],
    description: "You may trash a Copper from your hand for +$3.",
  },
  Poacher: {
    name: "Poacher",
    cost: 4,
    types: ["action"],
    description:
      "+1 Card, +1 Action, +$1. Discard a card per empty Supply pile.",
  },
  Remodel: {
    name: "Remodel",
    cost: 4,
    types: ["action"],
    description:
      "Trash a card from your hand. Gain a card costing up to $2 more than it.",
  },
  Smithy: {
    name: "Smithy",
    cost: 4,
    types: ["action"],
    description: "+3 Cards.",
  },
  "Throne Room": {
    name: "Throne Room",
    cost: 4,
    types: ["action"],
    description:
      "You may play an Action card from your hand twice.",
  },

  // Cost $5
  Bandit: {
    name: "Bandit",
    cost: 5,
    types: ["action", "attack"],
    description:
      "Gain a Gold. Each other player reveals the top 2 cards of their deck, trashes a revealed Treasure other than Copper, and discards the rest.",
  },
  "Council Room": {
    name: "Council Room",
    cost: 5,
    types: ["action"],
    description: "+4 Cards, +1 Buy. Each other player draws a card.",
  },
  Festival: {
    name: "Festival",
    cost: 5,
    types: ["action"],
    description: "+2 Actions, +1 Buy, +$2.",
  },
  Laboratory: {
    name: "Laboratory",
    cost: 5,
    types: ["action"],
    description: "+2 Cards, +1 Action.",
  },
  Library: {
    name: "Library",
    cost: 5,
    types: ["action"],
    description:
      "Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterwards.",
  },
  Market: {
    name: "Market",
    cost: 5,
    types: ["action"],
    description: "+1 Card, +1 Action, +1 Buy, +$1.",
  },
  Mine: {
    name: "Mine",
    cost: 5,
    types: ["action"],
    description:
      "You may trash a Treasure from your hand. Gain a Treasure to your hand costing up to $3 more than it.",
  },
  Sentry: {
    name: "Sentry",
    cost: 5,
    types: ["action"],
    description:
      "+1 Card, +1 Action. Look at the top 2 cards of your deck. Trash and/or discard any number of them. Put the rest back on top in any order.",
  },
  Witch: {
    name: "Witch",
    cost: 5,
    types: ["action", "attack"],
    description: "+2 Cards. Each other player gains a Curse.",
  },

  // Cost $6
  Artisan: {
    name: "Artisan",
    cost: 6,
    types: ["action"],
    description:
      "Gain a card to your hand costing up to $5. Put a card from your hand onto your deck.",
  },
};

// Kingdom cards only (excluding base treasures/victory/curse)
export const KINGDOM_CARDS: CardName[] = [
  "Cellar",
  "Chapel",
  "Moat",
  "Harbinger",
  "Merchant",
  "Vassal",
  "Village",
  "Workshop",
  "Bureaucrat",
  "Gardens",
  "Militia",
  "Moneylender",
  "Poacher",
  "Remodel",
  "Smithy",
  "Throne Room",
  "Bandit",
  "Council Room",
  "Festival",
  "Laboratory",
  "Library",
  "Market",
  "Mine",
  "Sentry",
  "Witch",
  "Artisan",
];

// Recommended first game setup
export const FIRST_GAME_KINGDOM: CardName[] = [
  "Cellar",
  "Market",
  "Militia",
  "Mine",
  "Moat",
  "Remodel",
  "Smithy",
  "Village",
  "Workshop",
  "Moneylender",
];

export function getCardImageUrl(cardName: CardName): string {
  // Handle spaces in card names
  const urlName = cardName.replace(/ /g, "_");
  return `https://robinzigmond.github.io/Dominion-app/images/card_images/${urlName}.jpg`;
}

export function isActionCard(cardName: CardName): boolean {
  return CARDS[cardName].types.includes("action");
}

export function isTreasureCard(cardName: CardName): boolean {
  return CARDS[cardName].types.includes("treasure");
}

export function isVictoryCard(cardName: CardName): boolean {
  return CARDS[cardName].types.includes("victory");
}

export function isAttackCard(cardName: CardName): boolean {
  return CARDS[cardName].types.includes("attack");
}

export function isReactionCard(cardName: CardName): boolean {
  return CARDS[cardName].types.includes("reaction");
}
