import type { CardName, PlayerState } from "../types/game-state";
import { countVP as countVPFromCards } from "./board-utils";

export function shuffle<T>(array: T[]): T[] {
  return [...array].reduceRight<T[]>(
    (result, _, currentIndex) => {
      if (currentIndex === 0) return result;
      const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
      [result[currentIndex], result[randomIndex]] = [
        result[randomIndex],
        result[currentIndex],
      ];
      return result;
    },
    [...array],
  );
}

type DrawEvent = { type: "draw"; cards: CardName[] } | { type: "shuffle" };

export function drawCards(
  playerState: PlayerState,
  count: number,
): { player: PlayerState; drawn: CardName[]; events: DrawEvent[] } {
  const {
    deck: playerDeck,
    discard: playerDiscard,
    hand: playerHand,
  } = playerState;
  const result = Array.from({ length: count }).reduce<{
    deck: CardName[];
    discard: CardName[];
    hand: CardName[];
    drawn: CardName[];
    events: DrawEvent[];
    currentBatch: CardName[];
  }>(
    (acc, _currentValue, _currentIndex, _array) => {
      if (acc.deck.length === 0) {
        if (acc.discard.length === 0) return acc;

        const eventsWithBatch =
          acc.currentBatch.length > 0
            ? [
                ...acc.events,
                { type: "draw" as const, cards: acc.currentBatch },
              ]
            : acc.events;

        return {
          ...acc,
          deck: shuffle(acc.discard),
          discard: [],
          events: [...eventsWithBatch, { type: "shuffle" as const }],
          currentBatch: [],
        };
      }

      const [card, ...remainingDeck] = acc.deck;
      if (!card) return acc;

      return {
        ...acc,
        deck: remainingDeck,
        hand: [...acc.hand, card],
        drawn: [...acc.drawn, card],
        currentBatch: [...acc.currentBatch, card],
      };
    },
    {
      deck: [...playerDeck],
      discard: [...playerDiscard],
      hand: [...playerHand],
      drawn: [],
      events: [],
      currentBatch: [],
    },
  );

  const finalEvents =
    result.currentBatch.length > 0
      ? [
          ...result.events,
          { type: "draw" as const, cards: result.currentBatch },
        ]
      : result.events;

  return {
    player: {
      ...playerState,
      deck: result.deck,
      hand: result.hand,
      discard: result.discard,
      deckTopRevealed: false,
    },
    drawn: result.drawn,
    events: finalEvents,
  };
}

/** Helper to add draw log entries in correct transactional order */
export function countVP({ deck, hand, discard, inPlay }: PlayerState): number {
  return countVPFromCards([...deck, ...hand, ...discard, ...inPlay]);
}
