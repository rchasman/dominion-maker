import type { Player } from "../types/game-state";
import { PLAYER_IDS } from "./constants";

/**
 * Converts a player index (0-3) to a Player ID (player0-player3)
 * Returns null if index is out of bounds
 */
export function getPlayerIdByIndex(index: number): Player | null {
  return (PLAYER_IDS[index] as Player | undefined) ?? null;
}
