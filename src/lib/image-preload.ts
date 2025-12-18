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
  preloadImage("/cards/Card_back.webp", 128);

  // Preload basic cards (in every game)
  CRITICAL_CARDS.map(card => {
    const url = getCardImageUrl(card);
    return preloadImage(url, 128); // Match small card width (supply piles)
  });
}

/**
 * Preload kingdom cards for the current game
 */
export function preloadKingdomCards(kingdomCards: CardName[]): void {
  kingdomCards.map(card => {
    const url = getCardImageUrl(card);
    return preloadImage(url, 160); // Match medium card width
  });
}

/**
 * Prefetch a single image for future use (loads during idle time)
 */
function preloadImage(url: string, width: number): void {
  const optimizedUrl = getOptimizedImageUrl({ url, width });

  // Check if already prefetched
  if (
    document.querySelector(
      `link[rel="prefetch"][href="${optimizedUrl}"], link[rel="prefetch"][imagesrcset*="${url}"]`,
    )
  ) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "image";
  link.href = optimizedUrl;
  // Prefetch single size - browser fetches during idle time
  // No warnings if unused, cached for when game starts

  document.head.appendChild(link);
}
