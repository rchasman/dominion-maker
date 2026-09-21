import { useMemo } from "preact/hooks";
import { goBoardGame } from "../../go/board-game";
import { createRemoteGoSession } from "../../go/create-remote-go-session";
import { BoardRoom } from "./BoardRoom";
import type { RoomProps } from "./room-chrome";

export function GoRoom(props: RoomProps) {
  const { roomId, playerName, clientId, isSpectator } = props;
  const session = useMemo(
    () => createRemoteGoSession({ roomId, playerName, clientId, isSpectator }),
    [roomId, playerName, clientId, isSpectator],
  );
  return <BoardRoom {...props} session={session} spec={goBoardGame} />;
}
