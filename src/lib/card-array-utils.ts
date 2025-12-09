/**
 * Utility functions for manipulating arrays of cards while properly handling duplicates
 */

import type { CardName } from "../types/game-state";

/**
 * Remove specific cards from an array, handling duplicates correctly.
 * Removes exactly the cards specified in toRemove, counting duplicates.
 *
 * @example
 * removeCards(["Estate", "Estate", "Copper"], ["Estate", "Estate"])
 * // Returns: ["Copper"]
 *
 * @example
 * removeCards(["Estate", "Estate", "Copper"], ["Estate"])
 * // Returns: ["Estate", "Copper"]
 */
export function removeCards(
  cards: CardName[],
  toRemove: CardName[],
): CardName[] {
  const removalCounts = new Map(
    [...new Set(toRemove)].map(card => [
      card,
      toRemove.filter(c => c === card).length,
    ]),
  );

  return cards.reduce(
    ({ result, seen }, card) => {
      const seenCount = seen.get(card) || 0;
      const removeCount = removalCounts.get(card) || 0;

      if (seenCount < removeCount) {
        return {
          result,
          seen: new Map(seen).set(card, seenCount + 1),
        };
      }

      return {
        result: [...result, card],
        seen: new Map(seen).set(card, seenCount + 1),
      };
    },
    { result: [] as CardName[], seen: new Map<CardName, number>() },
  ).result;
}

/**
 * Remove a single card from an array (first occurrence).
 *
 * @param fromEnd - If true, removes from end (for deck top), otherwise from start
 */
export function removeCard(
  cards: CardName[],
  card: CardName,
  fromEnd: boolean = false,
): CardName[] {
  const idx = fromEnd ? cards.lastIndexOf(card) : cards.indexOf(card);
  if (idx === -1) return cards;

  return [...cards.slice(0, idx), ...cards.slice(idx + 1)];
}
