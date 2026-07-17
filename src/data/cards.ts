import type { CardName } from "../types/game-state";
import type {
  CardType,
  ReactionTrigger,
  TriggerType,
  TriggerContext,
} from "../types/card-types";
import type { GameEvent } from "../events/types";

export type CardTrigger = {
  on: TriggerType;
  condition?: (ctx: TriggerContext) => boolean;
  effect: (ctx: TriggerContext) => GameEvent[];
};

export interface CardDefinition {
  name: CardName;
  cost: number;
  types: CardType[];
  description: string;
  // Vanilla strategy note surfaced to AI players that may not know Dominion
  strategy: string;
  // For treasure cards
  coins?: number;
  // For victory cards
  vp?: number | "variable";
  // For reaction cards
  reactionTrigger?: ReactionTrigger;
  // For cards with triggers
  triggers?: CardTrigger[];
}

export const CARDS: Record<CardName, CardDefinition> = {
  // Treasures
  Copper: {
    name: "Copper",
    cost: 0,
    types: ["treasure"],
    description: "+$1",
    strategy: "Never buy — every extra Copper dilutes your deck.",
    coins: 1,
  },
  Silver: {
    name: "Silver",
    cost: 3,
    types: ["treasure"],
    description: "+$2",
    strategy: "Solid early buy — the backbone of Big Money.",
    coins: 2,
  },
  Gold: {
    name: "Gold",
    cost: 6,
    types: ["treasure"],
    description: "+$3",
    strategy: "Strong buy at $6 unless a key action card matters more.",
    coins: 3,
  },

  // Victory
  Estate: {
    name: "Estate",
    cost: 2,
    types: ["victory"],
    description: "1 VP",
    strategy: "Skip until the game is ending — clogs hands, adds no economy.",
    vp: 1,
  },
  Duchy: {
    name: "Duchy",
    cost: 5,
    types: ["victory"],
    description: "3 VP",
    strategy: "Endgame buy at $5 when Provinces are running out.",
    vp: 3,
  },
  Province: {
    name: "Province",
    cost: 8,
    types: ["victory"],
    description: "6 VP",
    strategy: "The win condition — buy whenever you have $8.",
    vp: 6,
  },

  // Curse
  Curse: {
    name: "Curse",
    cost: 0,
    types: ["curse"],
    description: "-1 VP",
    strategy: "Never buy — negative VP and a dead draw.",
    vp: -1,
  },

  // Kingdom cards - Cost $2
  Cellar: {
    name: "Cellar",
    cost: 2,
    types: ["action"],
    description: "+1 Action. Discard any number of cards, then draw that many.",
    strategy:
      "Cheap glue — turns dead cards (Estates, extra Coppers) into fresh draws.",
  },
  Chapel: {
    name: "Chapel",
    cost: 2,
    types: ["action"],
    description: "Trash up to 4 cards from your hand.",
    strategy:
      "Top-tier — trash Coppers/Estates early to thin your deck; one copy is enough.",
  },
  Moat: {
    name: "Moat",
    cost: 2,
    types: ["action", "reaction"],
    reactionTrigger: "on_attack",
    description:
      "+2 Cards. When another player plays an Attack card, you may first reveal this from your hand, to be unaffected by it.",
    strategy:
      "Weak draw; buy mainly to block attacks. Always reveal it when attacked.",
  },

  // Cost $3
  Harbinger: {
    name: "Harbinger",
    cost: 3,
    types: ["action"],
    description:
      "+1 Card, +1 Action. Look through your discard pile. You may put a card from it onto your deck.",
    strategy:
      "Cheap non-terminal — topdeck your best discarded card to draw it next.",
  },
  Merchant: {
    name: "Merchant",
    cost: 3,
    types: ["action"],
    description:
      "+1 Card, +1 Action. The first time you play a Silver this turn, +$1.",
    strategy:
      "Fine early filler — non-terminal, pays off once you own Silvers.",
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
    strategy:
      "Gets better the more action cards your deck has; mediocre otherwise.",
  },
  Village: {
    name: "Village",
    cost: 3,
    types: ["action"],
    description: "+1 Card, +2 Actions.",
    strategy:
      "Enables playing multiple terminal actions per turn — useless without them.",
  },
  Workshop: {
    name: "Workshop",
    cost: 3,
    types: ["action"],
    description: "Gain a card costing up to $4.",
    strategy:
      "A free $4 card each play — good for fast building or a Gardens plan.",
  },

  // Cost $4
  Bureaucrat: {
    name: "Bureaucrat",
    cost: 4,
    types: ["action", "attack"],
    description:
      "Gain a Silver onto your deck. Each other player reveals a Victory card from their hand and puts it onto their deck (or reveals a hand with no Victory cards).",
    strategy:
      "Mild attack — free topdecked Silver each play, slows victory-heavy decks.",
  },
  Gardens: {
    name: "Gardens",
    cost: 4,
    types: ["victory"],
    description: "Worth 1 VP per 10 cards you have (round down).",
    strategy:
      "Alt win: wants a BIG deck — pairs with Workshop/extra buys; skip otherwise.",
    vp: "variable",
  },
  Militia: {
    name: "Militia",
    cost: 4,
    types: ["action", "attack"],
    description: "+$2. Each other player discards down to 3 cards in hand.",
    strategy: "Strong early attack plus $2 — one of the best $4 buys.",
  },
  Moneylender: {
    name: "Moneylender",
    cost: 4,
    types: ["action"],
    description: "You may trash a Copper from your hand for +$3.",
    strategy:
      "Thins a Copper AND still gives $3 — great early deck improvement.",
  },
  Poacher: {
    name: "Poacher",
    cost: 4,
    types: ["action"],
    description:
      "+1 Card, +1 Action, +$1. Discard a card per empty Supply pile.",
    strategy: "Solid non-terminal +$1; weakens late as supply piles empty.",
  },
  Remodel: {
    name: "Remodel",
    cost: 4,
    types: ["action"],
    description:
      "Trash a card from your hand. Gain a card costing up to $2 more than it.",
    strategy:
      "Upgrade engine: Estate into a $4 card early, Gold into Province late.",
  },
  Smithy: {
    name: "Smithy",
    cost: 4,
    types: ["action"],
    description: "+3 Cards.",
    strategy:
      "Great terminal draw — 1-2 copies plus treasures is a classic strong plan.",
  },
  "Throne Room": {
    name: "Throne Room",
    cost: 4,
    types: ["action"],
    description: "You may play an Action card from your hand twice.",
    strategy:
      "Only as good as your other action cards — needs strong targets first.",
  },

  // Cost $5
  Bandit: {
    name: "Bandit",
    cost: 5,
    types: ["action", "attack"],
    description:
      "Gain a Gold. Each other player reveals the top 2 cards of their deck, trashes a revealed Treasure other than Copper, and discards the rest.",
    strategy:
      "Free Gold each play while trashing opponents' Silver/Gold — strong tempo.",
  },
  "Council Room": {
    name: "Council Room",
    cost: 5,
    types: ["action"],
    description: "+4 Cards, +1 Buy. Each other player draws a card.",
    strategy:
      "Huge draw plus a buy, but gifts the opponent a card — use with strong turns.",
  },
  Festival: {
    name: "Festival",
    cost: 5,
    types: ["action"],
    description: "+2 Actions, +1 Buy, +$2.",
    strategy: "Non-terminal economy — actions, buy, and $2 with no downside.",
  },
  Laboratory: {
    name: "Laboratory",
    cost: 5,
    types: ["action"],
    description: "+2 Cards, +1 Action.",
    strategy: "Premium engine card — pure card advantage, never a dead draw.",
  },
  Library: {
    name: "Library",
    cost: 5,
    types: ["action"],
    description:
      "Draw until you have 7 cards in hand, skipping any Action cards you choose to; set those aside, discarding them afterwards.",
    strategy: "Best after attacks or with small hands — refills to 7 cards.",
  },
  Market: {
    name: "Market",
    cost: 5,
    types: ["action"],
    description: "+1 Card, +1 Action, +1 Buy, +$1.",
    strategy: "Always-safe non-terminal — a little of everything, never dead.",
  },
  Mine: {
    name: "Mine",
    cost: 5,
    types: ["action"],
    description:
      "You may trash a Treasure from your hand. Gain a Treasure to your hand costing up to $3 more than it.",
    strategy:
      "Slow treasure upgrading (Copper→Silver→Gold) — mediocre in most games.",
  },
  Sentry: {
    name: "Sentry",
    cost: 5,
    types: ["action"],
    description:
      "+1 Card, +1 Action. Look at the top 2 cards of your deck. Trash and/or discard any number of them. Put the rest back on top in any order.",
    strategy:
      "Excellent — trashes junk off the top of your deck every single play.",
  },
  Witch: {
    name: "Witch",
    cost: 5,
    types: ["action", "attack"],
    description: "+2 Cards. Each other player gains a Curse.",
    strategy:
      "Top-tier attack — every play junks the opponent's deck; buy early at $5.",
  },

  // Cost $6
  Artisan: {
    name: "Artisan",
    cost: 6,
    types: ["action"],
    description:
      "Gain a card to your hand costing up to $5. Put a card from your hand onto your deck.",
    strategy:
      "Gains a $5 card straight to hand — strong, flexible engine builder.",
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

export function isActionCard(cardName: CardName): boolean {
  return CARDS[cardName].types.includes("action");
}

export function isTreasureCard(cardName: CardName): boolean {
  return CARDS[cardName].types.includes("treasure");
}

/** Pure coin-adding treasures with no triggers or side effects */
export function isSimpleTreasure(cardName: CardName): boolean {
  const card = CARDS[cardName];
  return (
    card.types.includes("treasure") &&
    card.coins !== undefined &&
    !card.triggers
  );
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

export function getHandComposition(hand: CardName[]) {
  return {
    treasures: hand.filter(isTreasureCard).length,
    actions: hand.filter(isActionCard).length,
    total: hand.length,
  };
}
