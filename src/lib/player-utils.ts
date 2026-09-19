import type { GameState, PlayerId } from "../types/game-state";
import type { Seats } from "../core/seats";
import { firstHumanSeat } from "../core/seats";

export interface PlayerPerspective {
  localPlayerId: PlayerId;
  opponentPlayerId: PlayerId;
  allPlayerIds: readonly PlayerId[];
}

/**
 * Player ids from the local viewer's side of the table. In multiplayer the
 * viewer's own id is given; in a local game the viewer is the first human
 * seat, or the first player when nobody at the table is human (watch mode).
 */
export function getPlayerPerspective(
  state: GameState | null,
  seats: Seats,
  localPlayerId?: string | null,
): PlayerPerspective {
  const order = state ? state.playerOrder : Object.keys(seats);
  const local =
    localPlayerId && order.includes(localPlayerId)
      ? localPlayerId
      : (firstHumanSeat(seats, order) ?? order[0]);
  if (local === undefined) throw new Error("No players at the table");
  const rest = order.filter(id => id !== local);
  return {
    localPlayerId: local,
    opponentPlayerId: rest[0] ?? local,
    allPlayerIds: [local, ...rest],
  };
}
