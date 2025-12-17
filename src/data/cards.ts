import type { CardName } from "../types/game-state";
import type { GameEvent } from "../events/types";

// Card-specific constants
const CHAPEL_MAX_TRASH = 4;
const REMODEL_COST_BONUS = 2;
const MINE_COST_BONUS = 3;

export type CardType =
  | "treasure"
  | "victory"
  | "curse"
  | "action"
  | "attack"
  | "reaction";

export type ReactionTrigger =
  | "on_attack"
  | "on_gain"
  | "on_trash"
  | "on_discard";

export type TriggerType =
  | "treasure_played"
  | "card_gained"
  | "card_trashed"
  | "card_discarded";

export type TriggerContext = {
  card: CardName;
  isFirstOfType?: boolean;
  treasuresInPlay?: CardName[];
};

export type CardTrigger = {
  on: TriggerType;
  condition?: (ctx: TriggerContext) => boolean;
  effect: (ctx: TriggerContext) => GameEvent[];
};

// DSL types for decision requests
export type DecisionContext = {
  state: import("../types/game-state").GameState;
  player: string;
  stage?: string;
};

export type CardSelectionSource =
  | "hand"
  | "supply"
  | "revealed"
  | "options"
  | "discard";

export type DecisionSpec = {
  from: CardSelectionSource;
  prompt: string | ((ctx: DecisionContext) => string);
  cardOptions: CardName[] | ((ctx: DecisionContext) => CardName[]);
  min: number | ((ctx: DecisionContext) => number);
  max: number | ((ctx: DecisionContext) => number);
  metadata?:
    | Record<string, unknown>
    | ((ctx: DecisionContext) => Record<string, unknown>);
};

export interface CardDefinition {
  name: CardName;
  cost: number;
  types: CardType[];
  description: string;
  // For treasure cards
  coins?: number;
  // For victory cards
  vp?: number | "variable";
  // For reaction cards
  reactionTrigger?: ReactionTrigger;
  // For cards with triggers
  triggers?: CardTrigger[];
  // For cards with decisions (DSL)
  decisions?: Record<string, DecisionSpec>;
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
    decisions: {
      discard: {
        from: "hand",
        prompt: "Cellar: Discard any number of cards to draw that many",
        cardOptions: ctx => ctx.state.players[ctx.player].hand,
        min: 0,
        max: ctx => ctx.state.players[ctx.player].hand.length,
      },
    },
  },
  Chapel: {
    name: "Chapel",
    cost: 2,
    types: ["action"],
    description: "Trash up to 4 cards from your hand.",
    decisions: {
      trash: {
        from: "hand",
        prompt: "Chapel: Trash up to 4 cards from your hand",
        cardOptions: ctx => ctx.state.players[ctx.player].hand,
        min: 0,
        max: ctx =>
          Math.min(CHAPEL_MAX_TRASH, ctx.state.players[ctx.player].hand.length),
      },
    },
  },
  Moat: {
    name: "Moat",
    cost: 2,
    types: ["action", "reaction"],
    reactionTrigger: "on_attack",
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
    description:
      "+1 Card, +1 Action. The first time you play a Silver this turn, +$1.",
    triggers: [
      {
        on: "treasure_played",
        condition: ctx => ctx.card === "Silver" && (ctx.isFirstOfType ?? false),
        effect: () => [{ type: "COINS_MODIFIED", delta: 1 }],
      },
    ],
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
    decisions: {
      trash: {
        from: "hand",
        prompt: "Remodel: Choose a card to trash",
        cardOptions: ctx => ctx.state.players[ctx.player].hand,
        min: 1,
        max: 1,
      },
      gain: {
        from: "supply",
        prompt: ctx => {
          const trashedCard = ctx.state.pendingDecision?.metadata
            ?.trashedCard as CardName | undefined;
          if (!trashedCard) return "Remodel: Gain a card costing up to $2 more";
          const trashCost = CARDS[trashedCard].cost;
          const maxCost = trashCost + REMODEL_COST_BONUS;
          return `Remodel: Gain a card costing up to $${maxCost}`;
        },
        cardOptions: ctx => {
          const trashedCard = ctx.state.pendingDecision?.metadata
            ?.trashedCard as CardName | undefined;
          if (!trashedCard) return [];
          const trashCost = CARDS[trashedCard].cost;
          const maxCost = trashCost + REMODEL_COST_BONUS;
          return Object.entries(ctx.state.supply)
            .filter((entry): entry is [CardName, number] => {
              const [card, count] = entry;
              if (!(card in CARDS)) return false;
              return count > 0 && CARDS[card as CardName].cost <= maxCost;
            })
            .map(([card]) => card);
        },
        min: 1,
        max: 1,
        metadata: ctx => {
          const trashedCard = ctx.state.pendingDecision?.metadata
            ?.trashedCard as CardName | undefined;
          if (!trashedCard) return {};
          return {
            trashedCard,
            maxCost: CARDS[trashedCard].cost + REMODEL_COST_BONUS,
          };
        },
      },
    },
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
    description: "You may play an Action card from your hand twice.",
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
    decisions: {
      trash: {
        from: "hand",
        prompt: "Mine: Trash a Treasure from your hand",
        cardOptions: ctx =>
          ctx.state.players[ctx.player].hand.filter(c => {
            const cardDef = CARDS[c];
            return cardDef.types.includes("treasure");
          }),
        min: 1,
        max: 1,
      },
      gain: {
        from: "supply",
        prompt: ctx => {
          const trashedCard = ctx.state.pendingDecision?.metadata
            ?.trashedCard as CardName | undefined;
          if (!trashedCard)
            return "Mine: Gain a Treasure costing up to $3 more";
          const trashCost = CARDS[trashedCard].cost;
          const maxCost = trashCost + MINE_COST_BONUS;
          return `Mine: Gain a Treasure costing up to $${maxCost} to your hand`;
        },
        cardOptions: ctx => {
          const trashedCard = ctx.state.pendingDecision?.metadata
            ?.trashedCard as CardName | undefined;
          if (!trashedCard) return [];
          const trashCost = CARDS[trashedCard].cost;
          const maxCost = trashCost + MINE_COST_BONUS;
          return Object.entries(ctx.state.supply)
            .filter((entry): entry is [CardName, number] => {
              const [card, count] = entry;
              if (!(card in CARDS)) return false;
              const cardDef = CARDS[card as CardName];
              return (
                count > 0 &&
                cardDef.types.includes("treasure") &&
                cardDef.cost <= maxCost
              );
            })
            .map(([card]) => card);
        },
        min: 1,
        max: 1,
      },
    },
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
  return `/cards/${urlName}.webp`;
}

export function getCardImageFallbackUrl(cardName: CardName): string {
  const urlName = cardName.replace(/ /g, "_");
  return `/cards/${urlName}.jpg`;
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
