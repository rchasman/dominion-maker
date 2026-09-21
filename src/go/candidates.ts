/**
 * What the rules prove about a position and the moves it allows, and which
 * of those moves are worth offering. The text voters, Jev, the heuristic and
 * the board all read from here, so each fact is computed once and means the
 * same thing wherever it is shown.
 */

import {
  atariStones,
  finalScore,
  groupAt,
  groupsOn,
  isEyeOf,
  judgePlacement,
  judgedPlacements,
  leaderOf,
  lineOf,
  neighbourStones,
  neutralPoints,
  opponentOf,
  pointKey,
  pointLabel,
  replayMoves,
  rescuedStones,
  stoneName,
  stoneOf,
  territoryOf,
  type Candidate,
  type Point,
  type Stone,
  type Territory,
} from "./rules";
import type { GoMove, GoMoveRecord, GoScore, GoState } from "./shape";

const PASS: GoMove = { kind: "pass", label: "pass" };

/** What the rules prove about one placement, read off the board before and after the stone lands */
export type PlacementFacts = {
  /** Counted in from the nearest edge; line 1 is the edge itself */
  line: number;
  /** Enemy stones the stone lifts off the board */
  captures: number;
  /** Liberties of the group the stone joins, once its captures are lifted */
  libertiesAfter: number;
  /** Own stones the stone pulls out of atari */
  rescues: number;
  /** Enemy stones the stone leaves with one liberty */
  atari: number;
  touchesOwn: number;
  touchesEnemy: number;
};

/** The fact columns in the order every table and description shows them */
export const FACT_COLUMNS: readonly (keyof PlacementFacts)[] = [
  "line",
  "captures",
  "libertiesAfter",
  "rescues",
  "atari",
  "touchesOwn",
  "touchesEnemy",
];

export const placementFacts = (
  size: number,
  board: string,
  stone: Stone,
  candidate: Candidate,
): PlacementFacts => {
  const { point, placement } = candidate;
  return {
    line: lineOf(size, point),
    captures: placement.captured,
    libertiesAfter: groupAt(placement.board, size, point).liberties.length,
    rescues: rescuedStones(size, board, stone, candidate),
    atari: atariStones(size, placement.board, stone, point),
    touchesOwn: neighbourStones(size, board, point, stone),
    touchesEnemy: neighbourStones(size, board, point, opponentOf(stone)),
  };
};

/** A stone that leaves its own group on one liberty and lifts nothing: the opponent takes it next move */
export const isSelfAtari = (facts: PlacementFacts): boolean =>
  facts.libertiesAfter === 1 && facts.captures === 0;

const moverOf = (state: GoState): Stone => stoneOf(state.moves.length);

/** Every placement the rules allow the side to move, with the board each leaves, in board order */
export const legalCandidates = (state: GoState): Candidate[] => {
  const { positions } = replayMoves(state.size, state.moves);
  return judgedPlacements(state.size, state.board, positions, moverOf(state));
};

/** What the pass rule reads off a state; a replayed record fits it as well as a live game */
type PassPosition = Pick<GoState, "size" | "board"> & {
  moves: readonly GoMoveRecord[];
};

/** The opponent has just passed and the mover leads on area score, so a pass ends the game won */
export const passWinsNow = (state: PassPosition): boolean =>
  state.moves[state.moves.length - 1] === "pass" &&
  leaderOf(finalScore(state.board, state.size)) === state.moves.length % 2;

type Judged = { candidate: Candidate; facts: PlacementFacts };

/** A placement the rules cannot fault: no self-atari, and no fill of an own eye unless it saves stones by connecting */
const defensible = (state: GoState, stone: Stone, judged: Judged): boolean =>
  !isSelfAtari(judged.facts) &&
  (judged.facts.rescues > 0 ||
    !isEyeOf(state.size, state.board, stone, judged.candidate.point));

const placementMove = (size: number, point: Point): GoMove => ({
  kind: "place",
  x: point.x,
  y: point.y,
  label: pointLabel(size, point),
});

/**
 * No offered placement takes a neutral point, and both colours are on the
 * board. With one colour alone, a single stone "owns" every empty point,
 * which is a formality and no reason to stop playing. In a seki the shared
 * liberties stay neutral for good, but filling them is self-atari and never
 * offered, so neither side is held to filling its own territory before it
 * may pass.
 */
const settled = (state: GoState, kept: readonly Judged[]): boolean => {
  const { board, size } = state;
  const neutral = new Set(neutralPoints(board, size).map(pointKey));
  return (
    board.includes("B") &&
    board.includes("W") &&
    kept.every(entry => !neutral.has(pointKey(entry.candidate.point)))
  );
};

/**
 * The moves the voters are offered, in board order with the pass last. A
 * self-atari that captures nothing and a fill of an own eye are left out
 * while a defensible placement remains. The pass is offered only when it
 * wins the game outright, when no defensible placement remains, or when no
 * offered placement takes a neutral point, so nothing is left to take. The
 * engine still accepts every legal command; this shapes only what the voters
 * see.
 */
export const offeredMoves = (state: GoState): GoMove[] => {
  const stone = moverOf(state);
  const judged = legalCandidates(state).map(candidate => ({
    candidate,
    facts: placementFacts(state.size, state.board, stone, candidate),
  }));
  const kept = judged.filter(entry => defensible(state, stone, entry));
  const placements = (kept.length > 0 ? kept : judged).map(entry =>
    placementMove(state.size, entry.candidate.point),
  );
  const passOffered =
    passWinsNow(state) || kept.length === 0 || settled(state, kept);
  return passOffered ? [...placements, PASS] : placements;
};

/** An offered move with the facts behind it; a pass has none */
export type JudgedMove = { move: GoMove; facts: PlacementFacts | null };

/**
 * The facts behind each offered move, in the order given. A move the rules
 * refuse throws: the table is built from this same state, so one marks a
 * caller bug rather than a choice to describe.
 */
export const factsOf = (
  state: GoState,
  moves: readonly GoMove[],
): JudgedMove[] => {
  const stone = moverOf(state);
  const { positions } = replayMoves(state.size, state.moves);
  return moves.map(move => {
    if (move.kind === "pass") return { move, facts: null };
    const judged = judgePlacement(
      state.size,
      state.board,
      positions,
      stone,
      move,
    );
    if (!judged.ok) throw new Error(`${move.label} is ${judged.error}`);
    return {
      move,
      facts: placementFacts(state.size, state.board, stone, {
        point: move,
        placement: judged.placement,
      }),
    };
  });
};

export type GroupFacts = {
  stone: Stone;
  stones: number;
  /** The group's first stone in board order, naming it */
  around: string;
  liberties: number;
};

type PositionFacts = {
  /** The area score with komi counted, as the game would end now */
  score: GoScore;
  territory: Territory;
  /** Black's groups then White's, each side in board order */
  groups: GroupFacts[];
};

export const positionFacts = (state: GoState): PositionFacts => {
  const { board, size } = state;
  const groups = groupsOn(board, size).flatMap(group => {
    const [first] = group.stones;
    return first === undefined
      ? []
      : [
          {
            stone: group.stone,
            stones: group.stones.length,
            around: pointLabel(size, first),
            liberties: group.liberties.length,
          },
        ];
  });
  return {
    score: finalScore(board, size),
    territory: territoryOf(board, size),
    groups: [
      ...groups.filter(group => group.stone === "B"),
      ...groups.filter(group => group.stone === "W"),
    ],
  };
};

const standingOf = (score: GoScore): string => {
  const leader = leaderOf(score);
  if (leader === null) return "the game is tied";
  const margin = Math.abs(score.black - score.white);
  return `${stoneName(leader === 0 ? "B" : "W")} leads by ${margin}`;
};

/** "Black 24 to White 31.5 with komi counted: White leads by 7.5" */
export const describeScore = (score: GoScore): string =>
  `Black ${score.black} to White ${score.white} with komi counted: ${standingOf(score)}`;

/** What a pass does from here, with the score the game would then end at */
export const describePass = (state: GoState): string => {
  const score = describeScore(finalScore(state.board, state.size));
  return state.consecutivePasses > 0
    ? `ends the game now, scored as it stands: ${score}`
    : `ends the game if the opponent passes too; score would be ${score}`;
};
