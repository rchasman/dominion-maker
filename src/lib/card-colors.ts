import type { CardName } from "../types/game-state";
import { CARDS } from "../data/cards";
import { uiLogger } from "./logger";

export function getCardColor(card: CardName): string {
  const cardDef = CARDS[card];
  if (!cardDef) {
    uiLogger.error(`Card definition not found: ${card}`);
    return "var(--color-text-primary)";
  }
  // Priority order: curse > attack > reaction > treasure > victory > action
  if (cardDef.types.includes("curse")) return "var(--color-curse)";
  if (cardDef.types.includes("attack")) return "var(--color-attack)";
  if (cardDef.types.includes("reaction")) return "var(--color-reaction)";
  if (cardDef.types.includes("treasure")) return "var(--color-gold-bright)";
  if (cardDef.types.includes("victory")) return "var(--color-victory)";
  if (cardDef.types.includes("action")) return "var(--color-action)";
  return "var(--color-text-primary)";
}
