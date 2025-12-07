import type { GameState, CardName, PlayerState } from "../types/game-state";
import type { GameEvent, DecisionRequest, DecisionChoice } from "../events/types";
import { shuffle } from "../lib/game-utils";

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
  playerState: PlayerState,
  count: number
): { cards: CardName[]; shuffled: boolean; newDeckOrder?: CardName[]; cardsBeforeShuffle?: CardName[] } {
  const cards: CardName[] = [];
  const cardsBeforeShuffle: CardName[] = [];
  let deck = [...playerState.deck];
  let discard = [...playerState.discard];
  let shuffled = false;
  let newDeckOrder: CardName[] | undefined;

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      // Mark how many cards we drew before shuffling
      cardsBeforeShuffle.push(...cards);
      deck = shuffle(discard);
      discard = [];
      shuffled = true;
      // Capture full deck order BEFORE drawing for perfect replay
      newDeckOrder = [...deck];
    }
    // Top of deck is end of array
    const card = deck.pop();
    if (card) cards.push(card);
  }

  return { cards, shuffled, newDeckOrder, cardsBeforeShuffle: shuffled ? cardsBeforeShuffle : undefined };
}

/**
 * Get cards that can be gained from supply up to a cost limit.
 */
export function getGainableCards(state: GameState, maxCost: number): CardName[] {
  const { CARDS } = require("../data/cards");
  return Object.entries(state.supply)
    .filter(([card, count]) => {
      const cost = CARDS[card as CardName]?.cost ?? Infinity;
      return count > 0 && cost <= maxCost;
    })
    .map(([card]) => card as CardName);
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
  count: number
): GameEvent[] {
  const { cards, shuffled, newDeckOrder, cardsBeforeShuffle } = peekDraw(playerState, count);
  const events: GameEvent[] = [];

  if (shuffled && cardsBeforeShuffle) {
    // Draw cards before shuffle
    for (const card of cardsBeforeShuffle) {
      events.push({ type: "CARD_DRAWN", player, card });
    }

    // Then shuffle
    events.push({ type: "DECK_SHUFFLED", player, newDeckOrder });

    // Then draw remaining cards after shuffle
    const cardsAfterShuffle = cards.slice(cardsBeforeShuffle.length);
    for (const card of cardsAfterShuffle) {
      events.push({ type: "CARD_DRAWN", player, card });
    }
  } else {
    // No shuffle, just draw all cards
    for (const card of cards) {
      events.push({ type: "CARD_DRAWN", player, card });
    }
  }

  return events;
}

/**
 * Empty result (for cards with no immediate effect or fully handled by caller).
 */
export const EMPTY_RESULT: CardEffectResult = { events: [] };
