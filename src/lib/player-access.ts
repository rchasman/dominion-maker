/**
 * Safe player access helpers for noUncheckedIndexedAccess
 */

import type { GameState, PlayerState, PlayerId } from "../types/game-state";

/**
 * Get a player from state with runtime assertion.
 * Throws if player doesn't exist (should never happen in valid game state).
 */
export function getPlayer(state: GameState, playerId: PlayerId): PlayerState {
  const player = state.players[playerId];
  if (!player) {
    throw new Error(`Player ${playerId} not found in game state`);
  }
  return player;
}

/**
 * Check if a player exists in the game
 */
export function hasPlayer(state: GameState, playerId: PlayerId): boolean {
  return playerId in state.players;
}
