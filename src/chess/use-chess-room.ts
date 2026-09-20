/**
 * useChessRoom - The chess adapter for a generic game room
 *
 * The room hook speaks the wire protocol and nothing else. This is where the
 * opaque state and commands become chess ones, under this client's own id.
 */

import { useCallback, useMemo } from "preact/hooks";
import { z } from "zod";
import { multiplayerLogger } from "../lib/logger";
import { chessModule } from "./module";
import type { ChessCommand, ChessEvent, ChessState } from "./shape";

const UNREADABLE = "This room sent a position this client cannot read.";

const logSchema = z.array(chessModule.eventSchema);

/** What the room hook gives this adapter, all of it game-agnostic */
interface ChessRoom {
  /** The room module's projected state; null until the game starts */
  state: unknown;
  /** The room's log, as far as this client may see it */
  events: unknown[];
  playerId: string | null;
  sendCommand: (command: unknown) => void;
  /** The host's answer for the state at a past event */
  getStateAtEvent: (eventId: string) => Promise<unknown>;
}

interface ChessRoomGame {
  state: ChessState | null;
  /** Set when the room sent a state this client cannot read */
  error: string | null;
  /** The seat this client plays; null for a spectator */
  localPlayerId: string | null;
  /** The room's log as chess events; empty where this client cannot read it */
  events: ChessEvent[];
  /** The position at a past event, as the host replays it */
  stateAtEvent: (eventId: string) => Promise<ChessState>;
  move: (san: string) => void;
  resign: () => void;
}

export function useChessRoom({
  state,
  events,
  playerId,
  sendCommand,
  getStateAtEvent,
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

  const log = useMemo<ChessEvent[]>(() => {
    const parsed = logSchema.safeParse(events);
    if (parsed.success) return parsed.data;
    multiplayerLogger.error(
      `Room sent a log this chess client cannot read: ${parsed.error.message}`,
    );
    return [];
  }, [events]);

  const stateAtEvent = useCallback(
    async (eventId: string): Promise<ChessState> => {
      const answer = await getStateAtEvent(eventId);
      const parsed = chessModule.stateSchema.safeParse(answer);
      if (!parsed.success) throw new Error(UNREADABLE);
      return parsed.data;
    },
    [getStateAtEvent],
  );

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
    events: log,
    stateAtEvent,
    move,
    resign,
  };
}
