import type { CardName } from "../types/game-state";

const cardImageUrls = import.meta.glob<string>("../assets/card-images/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

function cardImageUrl(fileStem: string): string {
  const url = cardImageUrls[`../assets/card-images/${fileStem}.webp`];
  if (url === undefined) {
    throw new Error(`No card image for ${fileStem}`);
  }
  return url;
}

export const CARD_BACK_IMAGE_URL = cardImageUrl("Card_back");

export function getCardImageUrl(cardName: CardName): string {
  return cardImageUrl(cardName.replace(/ /g, "_"));
}
