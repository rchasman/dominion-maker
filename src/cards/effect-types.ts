import { applyEvents } from "../events/apply";
import { defineEffect, done, noMemory } from "./program";
import type { CardEffect, EffectContext } from "./program";
import type {
  GameState,
  CardName,
  PlayerState,
  PlayerId,
} from "../types/game-state";
import type { GameEvent } from "../events/types";
import { shuffle } from "../lib/game-utils";
import { CARDS } from "../data/cards";
import { getCardCost } from "./cost";
import type { ReactionTrigger } from "../types/card-types";
import { run } from "../lib/run";
import { isDecisionChoice } from "../types/pending-choice";
export { isDecisionChoice };

// Type guard for CardName - validates that a string is a known card
function isCardName(card: string): card is CardName {
  return card in CARDS;
}

/**
 * Peek at cards that would be drawn (without modifying state).
 * Handles shuffle if needed.
 * Returns the cards, whether a shuffle occurred, and the new deck order.
 */
export function peekDraw(
  { deck: playerDeck, discard: playerDiscard }: PlayerState,
  count: number,
  random: () => number = Math.random,
): {
  cards: CardName[];
  shuffled: boolean;
  newDeckOrder?: CardName[];
  cardsBeforeShuffle?: CardName[];
} {
  type AccState = {
    cards: CardName[];
    cardsBeforeShuffle: CardName[];
    deck: CardName[];
    discard: CardName[];
    shuffled: boolean;
    newDeckOrder?: CardName[];
  };

  const result = Array.from({ length: count }).reduce<AccState>(
    (acc, _currentValue, _currentIndex, _array) => {
      // Determine which deck to use
      const currentDeck =
        acc.deck.length === 0 && acc.discard.length > 0
          ? shuffle(acc.discard, random)
          : acc.deck;

      // Check if we shuffled
      const didShuffle = currentDeck !== acc.deck && acc.discard.length > 0;

      // If no cards available, return
      if (currentDeck.length === 0) return acc;

      // Draw the card
      const card = currentDeck[currentDeck.length - 1];
      if (!card) return acc;

      const nextState: AccState = {
        cards: [...acc.cards, card],
        cardsBeforeShuffle: didShuffle
          ? [...acc.cards]
          : acc.cardsBeforeShuffle,
        deck: currentDeck.slice(0, -1),
        discard: didShuffle ? [] : acc.discard,
        shuffled: acc.shuffled || didShuffle,
        ...run(() => {
          if (didShuffle) {
            return { newDeckOrder: [...currentDeck] };
          }
          if (acc.newDeckOrder !== undefined) {
            return { newDeckOrder: acc.newDeckOrder };
          }
          return {};
        }),
      };
      return nextState;
    },
    {
      cards: [],
      cardsBeforeShuffle: [],
      deck: [...playerDeck],
      discard: [...playerDiscard],
      shuffled: false,
    },
  );

  return {
    cards: result.cards,
    shuffled: result.shuffled,
    ...(result.newDeckOrder !== undefined && {
      newDeckOrder: result.newDeckOrder,
    }),
    ...(result.shuffled &&
      result.cardsBeforeShuffle !== undefined && {
        cardsBeforeShuffle: result.cardsBeforeShuffle,
      }),
  };
}

/**
 * Get cards that can be gained from supply up to a cost limit.
 */
export function getGainableCards(
  state: Pick<GameState, "supply" | "activeEffects">,
  maxCost: number,
): CardName[] {
  return Object.entries(state.supply)
    .filter((entry): entry is [CardName, number] => {
      const [card, count] = entry;
      if (!isCardName(card)) return false;
      return count > 0 && getCardCost(state, card).modifiedCost <= maxCost;
    })
    .map(([card]) => card);
}

/**
 * Get treasure cards that can be gained from supply up to a cost limit.
 */
export function getGainableTreasures(
  state: Pick<GameState, "supply" | "activeEffects">,
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
        getCardCost(state, card).modifiedCost <= maxCost
      );
    })
    .map(([card]) => card);
}

/**
 * Get opponents for attack cards.
 */
export function getOpponents(
  state: Pick<GameState, "playerOrder" | "players">,
  playerId: PlayerId,
): PlayerId[] {
  return state.playerOrder.filter(p => p !== playerId && state.players[p]);
}

/**
 * Create draw events for a player.
 * Properly handles shuffles that occur mid-draw.
 */
export function createDrawEvents(
  playerId: PlayerId,
  playerState: PlayerState,
  count: number,
  random: () => number = Math.random,
): GameEvent[] {
  const { cards, shuffled, newDeckOrder, cardsBeforeShuffle } = peekDraw(
    playerState,
    count,
    random,
  );

  if (shuffled && cardsBeforeShuffle) {
    const cardsAfterShuffle = cards.slice(cardsBeforeShuffle.length);
    return [
      ...cardsBeforeShuffle.map(card => ({
        type: "CARD_DRAWN" as const,
        playerId,
        card,
      })),
      {
        type: "DECK_SHUFFLED" as const,
        playerId,
        ...(newDeckOrder !== undefined && { newDeckOrder }),
      },
      ...cardsAfterShuffle.map(card => ({
        type: "CARD_DRAWN" as const,
        playerId,
        card,
      })),
    ];
  }

  return cards.map(card => ({ type: "CARD_DRAWN" as const, playerId, card }));
}

/**
 * Map a list of cards to discard or trash events.
 * Eliminates the repeated pattern of mapping selectedCards to movement events.
 */
export function cardsToEvents(
  cards: CardName[],
  playerId: PlayerId,
  type: "CARD_DISCARDED" | "CARD_TRASHED",
  from: "hand" | "deck" | "inPlay" = "hand",
): GameEvent[] {
  return cards.map(card => ({ type, playerId, card, from }));
}

/**
 * Get available reaction cards for a trigger (data-driven, no hardcoded card names)
 */
export function getAvailableReactions(
  state: Pick<GameState, "players">,
  playerId: PlayerId,
  trigger: ReactionTrigger,
): CardName[] {
  const playerState = state.players[playerId];
  if (!playerState) return [];

  return playerState.hand.filter(card => {
    const cardDef = CARDS[card];
    return cardDef.reactionTrigger === trigger;
  });
}

/** Card-local projections are rules state only; choices and logs are not inputs. */
export function projectEffectEvents(
  state: EffectContext["state"],
  events: GameEvent[],
): EffectContext["state"] {
  return applyEvents(
    { ...state, pendingChoice: null, pendingChoiceEventId: null, log: [] },
    events,
  );
}

export function createSimpleCardEffect(benefits: {
  cards?: number;
  actions?: number;
  buys?: number;
  coins?: number;
}): CardEffect {
  return defineEffect(noMemory, ({ state, playerId, random }) => {
    const player = state.players[playerId];
    if (!player) return done();
    return done([
      ...createDrawEvents(playerId, player, benefits.cards ?? 0, random),
      ...(benefits.actions
        ? [{ type: "ACTIONS_MODIFIED" as const, delta: benefits.actions }]
        : []),
      ...(benefits.buys
        ? [{ type: "BUYS_MODIFIED" as const, delta: benefits.buys }]
        : []),
      ...(benefits.coins
        ? [{ type: "COINS_MODIFIED" as const, delta: benefits.coins }]
        : []),
    ]);
  });
}
