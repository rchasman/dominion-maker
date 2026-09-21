/** Chess as the shared board-game screens see it */
import type { BoardGameSpec } from "../components/Board/board-game-spec";
import { ChessBoard } from "./ChessBoard";
import type { ChessSession } from "./chess-session";
import { CHESS_LOG_READING } from "./devtools";
import { chessModule } from "./module";
import { CHESS_SEAT_PRESETS } from "./presets";
import { CHESS_PLAYERS } from "./seat";
import type { ChessShape } from "./shape";
import { ChessLogRows, SIDE_COLORS } from "./sidebar";
import { chessStorage } from "./storage";

export const chessBoardGame: BoardGameSpec<ChessShape, ChessSession> = {
  module: chessModule,
  board: ({ session, ...board }) => (
    <ChessBoard {...board} onMove={session.move} />
  ),
  log: ({ state, playerNames }) => (
    <ChessLogRows state={state} playerNames={playerNames} />
  ),
  logEntryCount: state => state.moves.length,
  colours: SIDE_COLORS,
  players: CHESS_PLAYERS,
  presets: CHESS_SEAT_PRESETS,
  logReading: CHESS_LOG_READING,
  storage: chessStorage,
};
