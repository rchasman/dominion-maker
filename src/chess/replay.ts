import { Chess, type Move } from "chess.js";

/**
 * The SAN log played out from the opening, one verbose move per entry. A room
 * can hand this client a schema-valid log no engine produced, so a log that
 * does not replay reads as null and the caller falls back to the FEN and the
 * raw SAN it already has.
 */
export const replayMoves = (moves: readonly string[]): Move[] | null => {
  const chess = new Chess();
  try {
    for (const san of moves) chess.move(san);
  } catch {
    return null;
  }
  return chess.history({ verbose: true });
};
