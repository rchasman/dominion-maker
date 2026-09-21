/**
 * What the rules say about one side's moves in a game record: the counts the
 * eval reports, each judged on the board the move was played on, with the
 * same facts the voters were shown.
 */
import { passWinsNow, placementFacts } from "../candidates";
import {
  isEyeOf,
  isSelfAtari,
  judgePlacement,
  pointLabel,
  replayMoves,
  stoneOf,
  territoryOf,
  type Stone,
} from "../rules";
import type { GoMoveRecord, GoSize } from "../shape";

export type MoveStats = {
  firstLine: number;
  /** First-line moves that capture nothing, rescue nothing and put nothing in atari */
  quietFirstLine: number;
  selfAtari: number;
  eyeFills: number;
  passes: number;
  /**
   * Passes made while a neutral point was still on the board and the pass
   * did not end the game won. The definition plays a winning pass itself,
   * so one is never the model's call.
   */
  prematurePasses: number;
};

const NO_MOVES: MoveStats = {
  firstLine: 0,
  quietFirstLine: 0,
  selfAtari: 0,
  eyeFills: 0,
  passes: 0,
  prematurePasses: 0,
};

const addStats = (a: MoveStats, b: MoveStats): MoveStats => ({
  firstLine: a.firstLine + b.firstLine,
  quietFirstLine: a.quietFirstLine + b.quietFirstLine,
  selfAtari: a.selfAtari + b.selfAtari,
  eyeFills: a.eyeFills + b.eyeFills,
  passes: a.passes + b.passes,
  prematurePasses: a.prematurePasses + b.prematurePasses,
});

const count = (flag: boolean): number => (flag ? 1 : 0);

const judgeMove = (
  size: GoSize,
  before: readonly GoMoveRecord[],
  move: GoMoveRecord,
  stone: Stone,
): MoveStats => {
  const { board, positions } = replayMoves(size, before);
  if (move === "pass")
    return {
      ...NO_MOVES,
      passes: 1,
      prematurePasses: count(
        territoryOf(board, size).neutral > 0 &&
          !passWinsNow({ size, board, moves: before }),
      ),
    };
  const judged = judgePlacement(size, board, positions, stone, move);
  if (!judged.ok)
    throw new Error(`${pointLabel(size, move)} is ${judged.error}`);
  const facts = placementFacts(
    size,
    board,
    positions,
    stone,
  )({
    point: move,
    placement: judged.placement,
  });
  const firstLine = facts.line === 1;
  const quiet =
    facts.captures === 0 && facts.rescues === 0 && facts.atari === 0;
  return {
    ...NO_MOVES,
    firstLine: count(firstLine),
    quietFirstLine: count(firstLine && quiet),
    selfAtari: count(isSelfAtari(facts)),
    eyeFills: count(isEyeOf(size, board, stone, move)),
  };
};

/** The counts for every move `colour` played in the record */
export const gameStats = (
  size: GoSize,
  moves: readonly GoMoveRecord[],
  colour: Stone,
): MoveStats =>
  moves.reduce(
    (stats, move, index) =>
      stoneOf(index) === colour
        ? addStats(stats, judgeMove(size, moves.slice(0, index), move, colour))
        : stats,
    NO_MOVES,
  );
