import { useMemo } from "preact/hooks";
import { chessBoardGame } from "../../chess/board-game";
import { createRemoteChessSession } from "../../chess/create-remote-chess-session";
import { BoardRoom } from "./BoardRoom";
import type { RoomProps } from "./room-chrome";

export function ChessRoom(props: RoomProps) {
  const { roomId, playerName, clientId, isSpectator } = props;
  const session = useMemo(
    () =>
      createRemoteChessSession({ roomId, playerName, clientId, isSpectator }),
    [roomId, playerName, clientId, isSpectator],
  );
  return <BoardRoom {...props} session={session} spec={chessBoardGame} />;
}
