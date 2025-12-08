import { CARDS } from "../../../data/cards";
import type { CardName } from "../../../types/game-state";

// Helper to get card color based on card types
export const getCardColor = (cardName: CardName): string => {
  const cardTypes = CARDS[cardName]?.types || [];
  if (cardTypes.includes("curse")) return "var(--color-curse)";
  if (cardTypes.includes("victory")) return "var(--color-victory)";
  if (cardTypes.includes("treasure")) return "var(--color-gold)";
  if (cardTypes.includes("action")) return "var(--color-action)";
  return "var(--color-text-primary)";
};
