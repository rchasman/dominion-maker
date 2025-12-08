import type { GameState, CardName, PlayerState } from "../types/game-state";
import type {
  GameEvent,
  DecisionRequest,
  DecisionChoice,
} from "../events/types";
import { shuffle } from "../lib/game-utils";
import { CARDS } from "../data/cards";

// Type guard for CardName - validates that a string is a known card
function isCardName(card: string): card is CardName {
  return card in CARDS;
}

/**
 * Result of executing a card effect.
 */
export type CardEffectResult = {
  /** Events to emit (IDs will be added by engine) */
  events: GameEvent[];
  /** If set, pause for player decision before continuing */
  pendingDecision?: DecisionRequest;
};

/**
 * Context provided to card effects.
 */
export type CardEffectContext = {
  /** Current game state (read-only for effect logic) */
  state: GameState;
  /** Player who played the card (can be custom peer ID in multiplayer) */
  player: string;
  /** The card being played (for multi-stage effects) */
  card: CardName;
  /** Decision from player (if resuming a multi-stage effect) */
  decision?: DecisionChoice;
  /** Stage identifier for multi-stage effects */
  stage?: string;
};

/**
 * A card effect function.
 * Pure function that returns events to emit.
 */
export type CardEffect = (ctx: CardEffectContext) => CardEffectResult;

// ============================================
// HELPER FUNCTIONS FOR CARD EFFECTS
// ============================================

/**
 * Peek at cards that would be drawn (without modifying state).
 * Handles shuffle if needed.
 * Returns the cards, whether a shuffle occurred, and the new deck order.
 */
export function peekDraw(
  { deck: playerDeck, discard: playerDiscard }: PlayerState,
  count: number,
): {
  cards: CardName[];
  shuffled: boolean;
  newDeckOrder?: CardName[];
  cardsBeforeShuffle?: CardName[];
} {
  const cards: CardName[] = [];
  const cardsBeforeShuffle: CardName[] = [];
  let deck = [...playerDeck];
  let discard = [...playerDiscard];
  let shuffled = false;
  let newDeckOrder: CardName[] | undefined;

  let remaining = count;
  while (remaining > 0) {
    if (deck.length === 0) {
      if (discard.length === 0) break;

      // Capture state before shuffle
      cardsBeforeShuffle.push(...cards);
      deck = shuffle(discard);
      discard = [];
      shuffled = true;
      newDeckOrder = [...deck];
    }

    const card = deck.pop();
    if (card) cards.push(card);
    remaining--;
  }

  return {
    cards,
    shuffled,
    newDeckOrder,
    cardsBeforeShuffle: shuffled ? cardsBeforeShuffle : undefined,
  };
}

/**
 * Get cards that can be gained from supply up to a cost limit.
 */
export function getGainableCards(
  state: GameState,
  maxCost: number,
): CardName[] {
  return Object.entries(state.supply)
    .filter((entry): entry is [CardName, number] => {
      const [card, count] = entry;
      if (!isCardName(card)) return false;
      return count > 0 && CARDS[card].cost <= maxCost;
    })
    .map(([card]) => card);
}

/**
 * Get treasure cards that can be gained from supply up to a cost limit.
 */
export function getGainableTreasures(
  state: GameState,
  maxCost: number,
): CardName[] {
  return Object.entries(state.supply)
    .filter((entry): entry is [CardName, number] => {
      const [card, count] = entry;
      if (!isCardName(card)) return false;
      const cardDef = CARDS[card];
      return (
        count > 0 &&
        cardDef.types.includes("treasure") &&
        cardDef.cost <= maxCost
      );
    })
    .map(([card]) => card);
}

/**
 * Get opponents for attack cards.
 */
export function getOpponents(state: GameState, player: string): string[] {
  const playerOrder = state.playerOrder || ["human", "ai"];
  return playerOrder.filter(p => p !== player && state.players[p]);
}

/**
 * Create draw events for a player.
 * Properly handles shuffles that occur mid-draw.
 */
export function createDrawEvents(
  player: string,
  playerState: PlayerState,
  count: number,
): GameEvent[] {
  const { cards, shuffled, newDeckOrder, cardsBeforeShuffle } = peekDraw(
    playerState,
    count,
  );

  if (shuffled && cardsBeforeShuffle) {
    const cardsAfterShuffle = cards.slice(cardsBeforeShuffle.length);
    return [
      ...cardsBeforeShuffle.map(card => ({
        type: "CARD_DRAWN" as const,
        player,
        card,
      })),
      { type: "DECK_SHUFFLED" as const, player, newDeckOrder },
      ...cardsAfterShuffle.map(card => ({
        type: "CARD_DRAWN" as const,
        player,
        card,
      })),
    ];
  }

  return cards.map(card => ({ type: "CARD_DRAWN" as const, player, card }));
}

/**
 * Empty result (for cards with no immediate effect or fully handled by caller).
 */
export const EMPTY_RESULT: CardEffectResult = { events: [] };

// ============================================
// SIMPLE CARD EFFECT FACTORY
// ============================================

/**
 * Create a simple card effect that just provides benefits (cards, actions, buys, coins).
 * Used for cards like Smithy, Village, Laboratory, Moat, Festival, Market.
 */
export function createSimpleCardEffect(benefits: {
  cards?: number;
  actions?: number;
  buys?: number;
  coins?: number;
}): CardEffect {
  return ({ state, player }): CardEffectResult => {
    const events: GameEvent[] = [];

    if (benefits.cards) {
      events.push(
        ...createDrawEvents(player, state.players[player], benefits.cards),
      );
    }

    if (benefits.actions) {
      events.push({ type: "ACTIONS_MODIFIED", delta: benefits.actions });
    }

    if (benefits.buys) {
      events.push({ type: "BUYS_MODIFIED", delta: benefits.buys });
    }

    if (benefits.coins) {
      events.push({ type: "COINS_MODIFIED", delta: benefits.coins });
    }

    return { events };
  };
}

// ============================================
// DECISION REQUEST HELPERS
// ============================================

/**
 * Check if this is the initial call to a multi-stage card effect.
 */
export function isInitialCall(
  decision: DecisionChoice | undefined,
  stage: string | undefined,
): boolean {
  return !decision || stage === undefined;
}

/**
 * Create a card selection decision request with standard structure.
 */
export function createCardSelectionDecision(params: {
  player: string;
  from: "hand" | "supply" | "revealed" | "options" | "discard";
  prompt: string;
  cardOptions: CardName[];
  min: number;
  max: number;
  cardBeingPlayed: CardName;
  stage: string;
  metadata?: Record<string, unknown>;
}): DecisionRequest {
  return {
    type: "select_cards",
    player: params.player,
    from: params.from,
    prompt: params.prompt,
    cardOptions: params.cardOptions,
    min: params.min,
    max: params.max,
    cardBeingPlayed: params.cardBeingPlayed,
    stage: params.stage,
    metadata: params.metadata,
  };
}

// ============================================
// CARD TYPE CHECKING UTILITIES
// ============================================

/**
 * Check if a card is an Action card.
 */
export function isActionCard(card: CardName): boolean {
  return CARDS[card].types.includes("action");
}

/**
 * Check if a card is a Treasure card.
 */
export function isTreasureCard(card: CardName): boolean {
  return CARDS[card].types.includes("treasure");
}

/**
 * Check if a card is a Victory card.
 */
export function isVictoryCard(card: CardName): boolean {
  return CARDS[card].types.includes("victory");
}
