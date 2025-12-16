/**
 * Derived state utilities for GameContext
 * Pure functions that compute derived state from game state
 */

import type { GameState } from "../types/game-state";
import { isActionCard, isTreasureCard } from "../data/cards";

/**
 * Check if a player has playable actions
 */
export function hasPlayableActions(
  gameState: GameState | null,
  playerId?: string | null,
): boolean {
  if (!gameState) {
    return false;
  }

  const pid = playerId || "human";
  const playerState = gameState.players[pid];
  if (!playerState) {
    return false;
  }

  return playerState.hand.some(isActionCard) && gameState.actions > 0;
}

/**
 * Check if a player has treasures in hand
 */
export function hasTreasuresInHand(
  gameState: GameState | null,
  playerId?: string | null,
): boolean {
  if (!gameState) {
    return false;
  }

  const pid = playerId || "human";
  const playerState = gameState.players[pid];
  if (!playerState) {
    return false;
  }

  return playerState.hand.some(isTreasureCard);
}
