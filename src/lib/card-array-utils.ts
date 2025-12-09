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
  const remaining = [...cards];

  for (const cardToRemove of toRemove) {
    const idx = remaining.indexOf(cardToRemove);
    if (idx !== -1) {
      remaining.splice(idx, 1);
    }
  }

  return remaining;
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
