import type { CardName } from "../types/game-state";

/**
 * Generate WebP image URL for a card.
 * Extracted from cards.ts to avoid bundling entire CARDS object in Card component.
 */
export function getCardImageUrl(cardName: CardName): string {
  const urlName = cardName.replace(/ /g, "_");
  return `/cards/${urlName}.webp`;
}

/**
 * Generate fallback JPG image URL for a card.
 * Extracted from cards.ts to avoid bundling entire CARDS object in Card component.
 */
export function getCardImageFallbackUrl(cardName: CardName): string {
  const urlName = cardName.replace(/ /g, "_");
  return `/cards/${urlName}.jpg`;
}
