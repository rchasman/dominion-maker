import type { GameState, Player } from "../types/game-state";
import type { GameMode } from "../types/game-mode";
import { getPlayersForMode } from "../types/game-mode";

export interface PlayerPerspective {
  localPlayerId: Player;
  opponentPlayerId: Player;
  allPlayerIds: readonly Player[];
}

/**
 * Get player IDs organized from the perspective of the local player.
 * Returns the local player, their opponent, and all player IDs.
 *
 * In multiplayer mode, reorders players so the local player is first.
 * In single-player mode, returns players in their natural order.
 */
export function getPlayerPerspective(
  state: GameState | null,
  gameMode: GameMode,
  localPlayerId?: string | null,
): PlayerPerspective {
  // Get all player IDs
  let playerIds: Player[];
  if (!state) {
    playerIds = gameMode === "multiplayer"
      ? ["player0", "player1"]
      : (getPlayersForMode(gameMode) as Player[]);
  } else {
    playerIds = Object.keys(state.players) as Player[];
  }

  // In multiplayer, reorder so local player is first
  if (gameMode === "multiplayer" && localPlayerId) {
    const localIndex = playerIds.indexOf(localPlayerId as Player);
    if (localIndex > 0) {
      playerIds = [localPlayerId as Player, ...playerIds.filter(id => id !== localPlayerId)];
    }
  }

  return {
    localPlayerId: playerIds[0],
    opponentPlayerId: playerIds[1],
    allPlayerIds: playerIds,
  };
}
