import type { GameMode } from "../types/game-mode";
import type { PlayerId } from "../events/types";
import { GAME_MODE_CONFIG } from "../types/game-mode";

/**
 * Check if a player is AI-controlled in the current game mode.
 *
 * Returns false for multiplayer mode (no AI players).
 * For single-player modes, delegates to the mode's isAIPlayer config.
 */
export function isAIControlled(
  gameMode: GameMode,
  playerId: PlayerId,
): boolean {
  if (gameMode === "multiplayer") return false;
  return GAME_MODE_CONFIG[gameMode].isAIPlayer(playerId);
}
