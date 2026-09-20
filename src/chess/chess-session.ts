/**
 * What the chess board asks of its session, on a local table or in a room.
 * The shared table shapes carry the position; these add chess's verbs.
 */

import type { LocalTable, RoomTable } from "../session/table-session";
import type { ChessShape, ChessState } from "./shape";

type ChessTable = {
  readonly game: "chess";
  readonly move: (san: string) => void;
  readonly resign: () => void;
};

export type LocalChessSession = LocalTable<ChessShape> &
  ChessTable & {
    readonly getStateAtEvent: (eventId: string) => ChessState;
    /** Rewind to just before the human's own last move, so the human is to move again */
    readonly takeBack: () => void;
    /** Keep the position at this event and drop what came after it */
    readonly branchFrom: (eventId: string) => void;
    readonly newGame: () => void;
  };

export type RemoteChessSession = RoomTable<ChessShape> & ChessTable;

export type ChessSession = LocalChessSession | RemoteChessSession;
