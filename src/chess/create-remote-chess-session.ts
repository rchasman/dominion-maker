import { createRoomTurnSession } from "../session/create-room-turn-session";
import type { RoomTableOptions } from "../session/create-room-table";
import {
  chessVerbs,
  resignChess,
  type RemoteChessSession,
} from "./chess-session";
import { chessModule } from "./module";
import type { ChessShape } from "./shape";

export function createRemoteChessSession(
  options: Omit<RoomTableOptions, "game">,
): RemoteChessSession {
  const { act, ...room } = createRoomTurnSession<ChessShape>(chessModule, {
    ...options,
    game: "chess",
    resign: resignChess,
  });
  return { ...room, ...chessVerbs(act) };
}
