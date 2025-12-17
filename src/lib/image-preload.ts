import type { CardName } from "../types/game-state";
import { getCardImageUrl } from "../data/cards";

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
  preloadImage("/cards/Card_back.jpg", 300);

  // Preload basic cards (in every game)
  CRITICAL_CARDS.forEach(card => {
    const url = getCardImageUrl(card);
    preloadImage(url, 300);
  });
}

/**
 * Preload kingdom cards for the current game
 */
export function preloadKingdomCards(kingdomCards: CardName[]): void {
  kingdomCards.forEach(card => {
    const url = getCardImageUrl(card);
    preloadImage(url, 300);
  });
}

/**
 * Preload a single image using <link rel="preload">
 */
function preloadImage(url: string, _width: number): void {
  // Check if already preloaded
  if (
    document.querySelector(
      `link[rel="preload"][href="${url}"], link[rel="preload"][imagesrcset*="${url}"]`,
    )
  ) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  link.imageSrcset = `${url} 200w, ${url} 300w, ${url} 400w`;
  link.imageSizes = "300px";

  document.head.appendChild(link);
}
