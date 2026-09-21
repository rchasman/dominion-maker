import { seededIndex } from "../lib/seeded-draw";
import { legalCandidates, passWinsNow } from "./candidates";
import { sideToMove } from "./engine";
import {
  isEyeOf,
  neighbourStones,
  rescuedStones,
  stoneOf,
  type Candidate,
  type Point,
} from "./rules";
import type { GoCommand, GoPlayerId, GoState } from "./shape";

/** The first candidate with the highest measure, so a tie keeps board order */
const bestBy =
  (measure: (candidate: Candidate) => number) =>
  (best: Candidate, next: Candidate): Candidate =>
    measure(next) > measure(best) ? next : best;

const command = (playerId: GoPlayerId, point: Point | null): GoCommand =>
  point === null
    ? { type: "PASS", playerId }
    : { type: "PLACE", playerId, x: point.x, y: point.y };

const firstOf = <T>(
  pool: readonly T[],
  pick: (head: T) => T,
): T | undefined => {
  const head = pool[0];
  return head === undefined ? undefined : pick(head);
};

/**
 * The biggest capture, else the rescue of the biggest group in atari, else
 * the point touching the most own stones that is not an eye, else a point
 * the board alone decides. It passes when nothing is legal, or when the
 * opponent has just passed and the score already favours it. It throws once
 * the game is over: the seat driver only asks the side `whoMustAct` names,
 * so a call here after the end is a caller bug and should be loud.
 */
export function goHeuristic(state: GoState, playerId: GoPlayerId): GoCommand {
  if (state.gameOver) {
    throw new Error("Go heuristic was asked for a move after the game ended");
  }
  const mover = sideToMove(state);
  if (mover !== playerId) {
    throw new Error(
      `Go heuristic was asked for ${playerId}, but it is ${mover} to move`,
    );
  }

  const stone = stoneOf(state.moves.length);
  const candidates = legalCandidates(state);
  if (candidates.length === 0 || passWinsNow(state))
    return command(playerId, null);

  const capture = firstOf(candidates, head =>
    candidates.reduce(
      bestBy(candidate => candidate.placement.captured),
      head,
    ),
  );
  if (capture && capture.placement.captured > 0)
    return command(playerId, capture.point);

  const rescue = firstOf(candidates, head =>
    candidates.reduce(
      bestBy(candidate =>
        rescuedStones(state.size, state.board, stone, candidate),
      ),
      head,
    ),
  );
  if (rescue && rescuedStones(state.size, state.board, stone, rescue) > 0)
    return command(playerId, rescue.point);

  const openPoints = candidates.filter(
    candidate => !isEyeOf(state.size, state.board, stone, candidate.point),
  );
  const touching = openPoints.filter(
    candidate =>
      neighbourStones(state.size, state.board, candidate.point, stone) > 0,
  );
  const closest = firstOf(touching, head =>
    touching.reduce(
      bestBy(candidate =>
        neighbourStones(state.size, state.board, candidate.point, stone),
      ),
      head,
    ),
  );
  if (closest) return command(playerId, closest.point);

  const pool = openPoints.length > 0 ? openPoints : candidates;
  const drawn = firstOf(
    pool,
    head => pool[seededIndex(state.board, pool.length)] ?? head,
  );
  return command(playerId, drawn?.point ?? null);
}
