import { createChessGame, type ChessEngine } from "./engine";
import type { ChessPlayerOrder, ChessState } from "./shape";

/** Plays the SANs in turn order, White first, and throws on the first one the engine refuses */
export const playChessMoves = (
  engine: ChessEngine,
  players: ChessPlayerOrder,
  sans: readonly string[],
) =>
  sans.map((san, index) => {
    const playerId = index % 2 === 0 ? players[0] : players[1];
    const result = engine.dispatch({ type: "MOVE", playerId, san }, playerId);
    if (!result.ok) throw new Error(result.error);
    return result;
  });

/** The state of a fresh game after the SANs, White first */
export const chessStateAfter = (
  players: ChessPlayerOrder,
  sans: readonly string[],
): ChessState => {
  const engine = createChessGame([...players]);
  playChessMoves(engine, players, sans);
  return engine.state;
};
