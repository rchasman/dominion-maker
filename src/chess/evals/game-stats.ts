/**
 * What chess.js says about one side's moves in a game record: the counts the
 * eval reports, each judged on the position the move was played in, with the
 * same facts the voters were shown.
 */
import type { Color, Move } from "chess.js";
import {
  capturedSquare,
  capturedValue,
  hangsMovedPiece,
  landsOnCheaperAttacker,
  moveFacts,
} from "../facts";
import { replayMoves } from "../replay";

export type MoveStats = {
  /** Moves after which the moved piece stood attacked and unguarded, having won less than its worth */
  hung: number;
  /** Moves that landed a guarded piece where a cheaper enemy piece attacks it, having won less than the difference */
  cheaperAttacker: number;
  /** Pieces the opponent took that the side's next move did not answer with a capture, the second half of an even trade excepted */
  lostForFree: number;
  captures: number;
  checkmates: number;
};

const NO_MOVES: MoveStats = {
  hung: 0,
  cheaperAttacker: 0,
  lostForFree: 0,
  captures: 0,
  checkmates: 0,
};

const addStats = (a: MoveStats, b: MoveStats): MoveStats => ({
  hung: a.hung + b.hung,
  cheaperAttacker: a.cheaperAttacker + b.cheaperAttacker,
  lostForFree: a.lostForFree + b.lostForFree,
  captures: a.captures + b.captures,
  checkmates: a.checkmates + b.checkmates,
});

const count = (flag: boolean): number => (flag ? 1 : 0);

const judgeOwnMove = (move: Move): MoveStats => {
  const facts = moveFacts(move);
  const hung = hangsMovedPiece(facts);
  return {
    ...NO_MOVES,
    hung: count(hung),
    cheaperAttacker: count(!hung && landsOnCheaperAttacker(facts)),
    captures: count(move.captured !== undefined),
    checkmates: count(move.san.endsWith("#")),
  };
};

/** The opponent took back on the square the side had just captured on, for no more than the side took there */
const recapturesEvenly = (move: Move, ownBefore: Move | undefined): boolean =>
  move.captured !== undefined &&
  ownBefore?.captured !== undefined &&
  capturedSquare(move) === ownBefore.to &&
  capturedValue(move.captured) <= capturedValue(ownBefore.captured);

/**
 * A capture the side answered with no capture of its own. The recapture that
 * completes an even trade is not a loss, and a reply that never came is not
 * judged.
 */
const judgeOpponentMove = (
  move: Move,
  ownBefore: Move | undefined,
  reply: Move | undefined,
): MoveStats => ({
  ...NO_MOVES,
  lostForFree: count(
    move.captured !== undefined &&
      reply !== undefined &&
      reply.captured === undefined &&
      !recapturesEvenly(move, ownBefore),
  ),
});

/** The counts for every move `colour` played in the record; throws when the record does not replay */
export const gameStats = (
  sans: readonly string[],
  colour: Color,
): MoveStats => {
  const moves = replayMoves(sans);
  if (moves === null) throw new Error("The game record does not replay");
  return moves.reduce(
    (stats, move, index) =>
      addStats(
        stats,
        move.color === colour
          ? judgeOwnMove(move)
          : judgeOpponentMove(move, moves[index - 1], moves[index + 1]),
      ),
    NO_MOVES,
  );
};
