import type { CardName } from "../types/game-state";
import { getCardImageUrl } from "../data/card-urls";
import { getOptimizedImageUrl } from "./image-optimization";

/**
 * Critical images that should be preloaded on every game
 * (cards that appear in all games)
 */
const CRITICAL_CARDS: CardName[] = [
  "Copper",
  "Silver",
  "Gold",
  "Estate",
  "Duchy",
  "Province",
  "Curse",
];

/**
 * Preload critical card images for faster initial render
 */
export function preloadCriticalImages(): void {
  // Preload card back (always visible)
  preloadImage("/cards/Card_back.jpg", 128);

  // Preload basic cards (in every game)
  CRITICAL_CARDS.forEach(card => {
    const url = getCardImageUrl(card);
    preloadImage(url, 128); // Match small card width (supply piles)
  });
}

/**
 * Preload kingdom cards for the current game
 */
export function preloadKingdomCards(kingdomCards: CardName[]): void {
  kingdomCards.forEach(card => {
    const url = getCardImageUrl(card);
    preloadImage(url, 160); // Match medium card width
  });
}

/**
 * Preload a single image using <link rel="preload">
 */
function preloadImage(url: string, width: number): void {
  const optimizedUrl = getOptimizedImageUrl({ url, width });

  // Check if already preloaded
  if (
    document.querySelector(
      `link[rel="preload"][href="${optimizedUrl}"], link[rel="preload"][imagesrcset*="${url}"]`,
    )
  ) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = optimizedUrl;
  // Only preload single size to avoid unused preloads
  // Browser will fetch other sizes on-demand

  document.head.appendChild(link);
}
