/**
 * A remote chess session is a generic room table read as chess: moves and
 * resignations become one command each under this client's own id.
 */

import { multiplayerLogger } from "../lib/logger";
import {
  createRoomTable,
  type RoomTableOptions,
} from "../session/create-room-table";
import type { RemoteChessSession } from "./chess-session";
import { chessModule } from "./module";
import type { ChessCommand, ChessShape } from "./shape";

export function createRemoteChessSession(
  options: Omit<RoomTableOptions, "game">,
): RemoteChessSession {
  const { act, subscribe, ...room } = createRoomTable<ChessShape>(chessModule, {
    ...options,
    game: "chess",
  });
  void subscribe;

  const command = (build: (id: string) => ChessCommand) => {
    const result = act(build);
    if (!result.ok) multiplayerLogger.warn(result.error);
  };

  return {
    ...room,
    game: "chess",
    move: san => command(id => ({ type: "MOVE", playerId: id, san })),
    resign: () => command(id => ({ type: "RESIGN", playerId: id })),
  };
}
