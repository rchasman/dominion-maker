/**
 * Derived state utilities for GameContext
 * Pure functions that compute derived state from game state
 */

import type { GameState } from "../types/game-state";
import { isActionCard, isTreasureCard } from "../data/cards";

/**
 * Check if human player has playable actions
 */
export function hasPlayableActions(gameState: GameState | null): boolean {
  if (!gameState) {
    return false;
  }

  const humanState = gameState.players.human;
  if (!humanState) {
    return false;
  }

  return humanState.hand.some(isActionCard) && gameState.actions > 0;
}

/**
 * Check if human player has treasures in hand
 */
export function hasTreasuresInHand(gameState: GameState | null): boolean {
  if (!gameState) {
    return false;
  }

  const humanState = gameState.players.human;
  if (!humanState) {
    return false;
  }

  return humanState.hand.some(isTreasureCard);
}
