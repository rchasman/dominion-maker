import type { Seats } from "../core/seats";
import { createLocalTurnSession } from "../session/create-local-turn-session";
import {
  chessVerbs,
  resignChess,
  type LocalChessSession,
} from "./chess-session";
import { chessModule } from "./module";
import { createChessGame, type ChessEngine } from "./engine";
import { CHESS_PLAYERS } from "./seat";
import type { ChessShape } from "./shape";

const CHESS_SEAT_NAMES = [
  { id: "w", name: "White" },
  { id: "b", name: "Black" },
];

export function createLocalChessSession(
  table: { engine: ChessEngine; seats: Seats },
  options: { stepDelayMs?: number } = {},
): LocalChessSession {
  const { act, ...session } = createLocalTurnSession<ChessShape, ChessEngine>({
    module: chessModule,
    engine: table.engine,
    seats: table.seats,
    players: CHESS_SEAT_NAMES,
    createEngine: () => createChessGame([...CHESS_PLAYERS]),
    resign: resignChess,
    ...options,
  });
  return { ...session, ...chessVerbs(act) };
}
