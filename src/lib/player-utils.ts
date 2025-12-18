import type { GameState, PlayerId } from "../types/game-state";
import type { GameMode } from "../types/game-mode";
import { getPlayersForMode } from "../types/game-mode";

export interface PlayerPerspective {
  localPlayerId: PlayerId;
  opponentPlayerId: PlayerId;
  allPlayerIds: readonly PlayerId[];
}

/**
 * Get player IDs organized from the perspective of the local player.
 * Returns the local playerId, their opponent, and all player IDs.
 *
 * In multiplayer mode, reorders players so the local player is first.
 * In single-player mode, returns players in their natural order.
 */
export function getPlayerPerspective(
  state: GameState | null,
  gameMode: GameMode,
  localPlayerId?: string | null
): PlayerPerspective {
  // Get all player IDs
  let playerIds: PlayerId[];
  if (!state) {
    playerIds =
      gameMode === "multiplayer"
        ? ["player0", "player1"]
        : (getPlayersForMode(gameMode) as PlayerId[]);
  } else {
    playerIds = Object.keys(state.players) as PlayerId[];
  }

  // In multiplayerId, reorder so local player is first
  if (gameMode === "multiplayer" && localPlayerId) {
    const localIndex = playerIds.indexOf(localPlayerId as PlayerId);
    if (localIndex > 0) {
      playerIds = [
        localPlayerId as playerId,
        ...playerIds.filter(id => id !== localPlayerId),
      ];
    }
  }

  return {
    localPlayerId: playerIds[0],
    opponentPlayerId: playerIds[1],
    allPlayerIds: playerIds,
  };
}
