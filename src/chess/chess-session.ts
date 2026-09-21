/**
 * What the chess board asks of its session, on a local table or in a room.
 * The shared table shapes carry the position; these add chess's verbs.
 */

import type { CommandFor } from "../session/create-local-turn-session";
import type { LocalTurnTable, RoomTable } from "../session/table-session";
import type { ChessShape } from "./shape";

type ChessTable = {
  readonly game: "chess";
  readonly move: (san: string) => void;
};

export type LocalChessSession = LocalTurnTable<ChessShape> & ChessTable;

export type RemoteChessSession = RoomTable<ChessShape> & ChessTable;

export type ChessSession = LocalChessSession | RemoteChessSession;

export const resignChess: CommandFor<ChessShape> = playerId => ({
  type: "RESIGN",
  playerId,
});

/** Chess's one verb, built on whichever table's `act` it is handed */
export const chessVerbs = (
  act: (build: CommandFor<ChessShape>) => void,
): ChessTable => ({
  game: "chess",
  move: san => act(playerId => ({ type: "MOVE", playerId, san })),
});
