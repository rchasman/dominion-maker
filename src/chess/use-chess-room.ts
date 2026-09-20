/**
 * useChessRoom - The chess adapter for a generic game room
 *
 * The room hook speaks the wire protocol and nothing else. This is where the
 * opaque state and commands become chess ones, under this client's own id.
 */

import { useCallback, useMemo } from "preact/hooks";
import { multiplayerLogger } from "../lib/logger";
import { chessModule } from "./module";
import type { ChessCommand, ChessState } from "./shape";

const UNREADABLE = "This room sent a position this client cannot read.";

/** What the room hook gives this adapter, all of it game-agnostic */
interface ChessRoom {
  /** The room module's projected state; null until the game starts */
  state: unknown;
  playerId: string | null;
  sendCommand: (command: unknown) => void;
}

interface ChessRoomGame {
  state: ChessState | null;
  /** Set when the room sent a state this client cannot read */
  error: string | null;
  /** The seat this client plays; null for a spectator */
  localPlayerId: string | null;
  move: (san: string) => void;
  resign: () => void;
}

export function useChessRoom({
  state,
  playerId,
  sendCommand,
}: ChessRoom): ChessRoomGame {
  const read = useMemo<{
    state: ChessState | null;
    error: string | null;
  }>(() => {
    if (state === null || state === undefined)
      return { state: null, error: null };
    const parsed = chessModule.stateSchema.safeParse(state);
    if (!parsed.success) {
      multiplayerLogger.error(
        `Room sent a state this chess client cannot read: ${parsed.error.message}`,
      );
      return { state: null, error: UNREADABLE };
    }
    return { state: parsed.data, error: null };
  }, [state]);

  /** Only a seated player may act, and always under their own id */
  const dispatch = useCallback(
    (build: (id: string) => ChessCommand) => {
      if (playerId === null) {
        multiplayerLogger.warn("Spectators cannot act");
        return;
      }
      sendCommand(build(playerId));
    },
    [playerId, sendCommand],
  );

  const move = useCallback(
    (san: string) => {
      dispatch(id => ({ type: "MOVE", playerId: id, san }));
    },
    [dispatch],
  );

  const resign = useCallback(() => {
    dispatch(id => ({ type: "RESIGN", playerId: id }));
  }, [dispatch]);

  return {
    state: read.state,
    error: read.error,
    localPlayerId: playerId,
    move,
    resign,
  };
}
