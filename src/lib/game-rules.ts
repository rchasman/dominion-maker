import type { GameState, CardName } from "../types/game-state";
import { isActionCard, isTreasureCard } from "../data/cards";

/**
 * Check if a card can be played in the current game state.
 * Returns separate flags for action and treasure playability.
 */
export function canPlayCard(
  card: CardName,
  phase: GameState["phase"],
  actions: number,
  isLocalPlayerTurn: boolean,
): { canPlayAction: boolean; canPlayTreasure: boolean } {
  if (!isLocalPlayerTurn) {
    return { canPlayAction: false, canPlayTreasure: false };
  }

  return {
    canPlayAction: phase === "action" && isActionCard(card) && actions > 0,
    canPlayTreasure: phase === "buy" && isTreasureCard(card),
  };
}

/**
 * Check if the player can buy cards in the current state.
 * Considers turn ownership, phase, buys remaining, and preview mode.
 */
export function canBuyCards(
  isLocalPlayerTurn: boolean,
  phase: GameState["phase"],
  buys: number,
  isPreviewMode: boolean,
): boolean {
  return isLocalPlayerTurn && phase === "buy" && buys > 0 && !isPreviewMode;
}
