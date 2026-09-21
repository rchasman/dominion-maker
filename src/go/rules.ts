/**
 * Go's board logic with no engine and no events: what a stone does when it
 * lands, which placements the rules allow, and what a finished board is
 * worth. The engine, the definition and the heuristic all read the rules
 * from here, so they live once.
 */

import type { GoMoveRecord, GoScore } from "./shape";

/** Area scoring's compensation for Black moving first, given to White */
export const KOMI = 7.5;

/** Column letters skip I, as every Go board does, so no column reads as a one */
const COLUMNS = "ABCDEFGHJKLMNOPQRST";

const EMPTY = ".";

export type Stone = "B" | "W";

/** Zero-based from the top-left corner, the way the board string is laid out */
export type Point = { x: number; y: number };

const emptyBoard = (size: number): string => EMPTY.repeat(size * size);

/** "D4": the column letter, then the row counted up from the bottom edge */
export const pointLabel = (size: number, point: Point): string =>
  `${COLUMNS.charAt(point.x)}${size - point.y}`;

/** "D4" for a stone and "pass" for a pass, as a game record reads */
export const recordLabel = (size: number, move: GoMoveRecord): string =>
  move === "pass" ? "pass" : pointLabel(size, move);

/** "3,5": a point as a set member or a list key, needing no board size */
export const pointKey = (point: Point): string => `${point.x},${point.y}`;

export const columnLabels = (size: number): string[] =>
  COLUMNS.slice(0, size).split("");

/** The column letters spaced to sit over the stones of `boardRows` */
export const boardHeader = (size: number): string =>
  `   ${columnLabels(size).join(" ")}`;

/** One line per row, numbered from the top so row 1 is the bottom edge, each stone drawn by `glyphOf` */
export const boardRows = (
  board: string,
  size: number,
  glyphOf: (stone: string) => string,
): string[] =>
  Array.from({ length: size }, (_, y) => {
    const stones = board
      .slice(y * size, (y + 1) * size)
      .split("")
      .map(glyphOf)
      .join(" ");
    return `${String(size - y).padStart(2)} ${stones}`;
  });

/** Black plays the even-numbered moves, counting from zero */
export const stoneOf = (moveIndex: number): Stone =>
  moveIndex % 2 === 0 ? "B" : "W";

export const opponentOf = (stone: Stone): Stone => (stone === "B" ? "W" : "B");

export const stoneName = (stone: Stone): string =>
  stone === "B" ? "Black" : "White";

const indexOf = (size: number, point: Point): number =>
  point.y * size + point.x;

const pointAt = (size: number, index: number): Point => ({
  x: index % size,
  y: Math.floor(index / size),
});

const onBoard = (size: number, point: Point): boolean =>
  point.x >= 0 && point.y >= 0 && point.x < size && point.y < size;

const allPoints = (size: number): Point[] =>
  Array.from({ length: size * size }, (_, index) => pointAt(size, index));

/** Lines are counted in from the nearest edge, the way players read a board */
export const lineOf = (size: number, point: Point): number =>
  Math.min(point.x, point.y, size - 1 - point.x, size - 1 - point.y) + 1;

const neighbours = (size: number, point: Point): Point[] =>
  [
    { x: point.x, y: point.y - 1 },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
  ].filter(next => onBoard(size, next));

export const stoneAt = (board: string, size: number, point: Point): string =>
  board.charAt(indexOf(size, point));

type Fill = { inside: Point[]; edge: Point[] };

/**
 * The connected points through `start` that `isInside` accepts, and the
 * points touching them that it does not. The stack and the two sets are
 * local to this call; nothing mutable leaves it.
 */
function floodFill(
  board: string,
  size: number,
  start: Point,
  isInside: (stone: string) => boolean,
): Fill {
  const inside = new Set<number>([indexOf(size, start)]);
  const edge = new Set<number>();
  const pending: Point[] = [start];
  while (pending.length > 0) {
    const point = pending.pop();
    if (point === undefined) break;
    for (const next of neighbours(size, point)) {
      const index = indexOf(size, next);
      if (!isInside(board.charAt(index))) edge.add(index);
      else if (!inside.has(index)) {
        inside.add(index);
        pending.push(next);
      }
    }
  }
  return {
    inside: [...inside].map(index => pointAt(size, index)),
    edge: [...edge].map(index => pointAt(size, index)),
  };
}

type Group = { stones: Point[]; liberties: Point[] };

const libertiesOf = (board: string, size: number, edge: Point[]): Point[] =>
  edge.filter(point => stoneAt(board, size, point) === EMPTY);

/** The stones joined to the one on `start`, and the empty points they touch */
export function groupAt(board: string, size: number, start: Point): Group {
  const colour = stoneAt(board, size, start);
  const { inside, edge } = floodFill(
    board,
    size,
    start,
    stone => stone === colour,
  );
  return { stones: inside, liberties: libertiesOf(board, size, edge) };
}

/** A connected run of one character, flooded from its first point in board order */
type Component<S extends string> = Fill & { stone: S };

type Partition<S extends string> = {
  claimed: ReadonlySet<number>;
  found: Component<S>[];
};

/**
 * The board cut into the connected runs of the characters `accepts` picks
 * out, in board order: the groups when it picks stones, the empty areas when
 * it picks the dot. Each run is flooded once, from its first point.
 */
const components = <S extends string>(
  board: string,
  size: number,
  accepts: (current: string) => current is S,
): Component<S>[] =>
  allPoints(size).reduce<Partition<S>>(
    (tally, point) => {
      const stone = stoneAt(board, size, point);
      if (!accepts(stone) || tally.claimed.has(indexOf(size, point)))
        return tally;
      const fill = floodFill(board, size, point, current => current === stone);
      return {
        claimed: new Set([
          ...tally.claimed,
          ...fill.inside.map(next => indexOf(size, next)),
        ]),
        found: [...tally.found, { ...fill, stone }],
      };
    },
    { claimed: new Set<number>(), found: [] },
  ).found;

const isStone = (current: string): current is Stone =>
  current === "B" || current === "W";

const isEmpty = (current: string): current is typeof EMPTY => current === EMPTY;

type ColouredGroup = Group & { stone: Stone };

/** Every group on the board in board order; each group's first stone is its first in board order */
export const groupsOn = (board: string, size: number): ColouredGroup[] =>
  components(board, size, isStone).map(component => ({
    stone: component.stone,
    stones: component.inside,
    liberties: libertiesOf(board, size, component.edge),
  }));

const withStones = (
  board: string,
  size: number,
  points: readonly Point[],
  stone: string,
): string => {
  const indices = new Set(points.map(point => indexOf(size, point)));
  return [...board]
    .map((current, index) => (indices.has(index) ? stone : current))
    .join("");
};

type Placement = { board: string; captured: number };

type PlacementError =
  | "off the board"
  | "occupied"
  | "suicide"
  | "a repeat of an earlier position";

type Judged =
  | { ok: true; placement: Placement }
  | { ok: false; error: PlacementError };

/**
 * The board after `stone` lands on `point` and lifts every enemy group it
 * leaves without a liberty, or the rule that refuses it. Positional superko
 * compares the whole board with every board the game has shown, the empty
 * one included, so a longer cycle is caught the same way a simple ko is.
 */
export function judgePlacement(
  size: number,
  board: string,
  positions: ReadonlySet<string>,
  stone: Stone,
  point: Point,
): Judged {
  if (!onBoard(size, point)) return { ok: false, error: "off the board" };
  if (stoneAt(board, size, point) !== EMPTY)
    return { ok: false, error: "occupied" };
  const placed = withStones(board, size, [point], stone);
  const enemy = opponentOf(stone);
  const captured = neighbours(size, point)
    .filter(next => stoneAt(placed, size, next) === enemy)
    .map(next => groupAt(placed, size, next))
    .filter(group => group.liberties.length === 0)
    .flatMap(group => group.stones);
  const afterCaptures = withStones(placed, size, captured, EMPTY);
  if (groupAt(afterCaptures, size, point).liberties.length === 0)
    return { ok: false, error: "suicide" };
  if (positions.has(afterCaptures))
    return { ok: false, error: "a repeat of an earlier position" };
  // Two neighbours in one enemy group name its stones twice
  const lifted = new Set(captured.map(next => indexOf(size, next))).size;
  return { ok: true, placement: { board: afterCaptures, captured: lifted } };
}

export type Candidate = { point: Point; placement: Placement };

/** Every placement the rules allow and the board it leaves, in board order */
export const judgedPlacements = (
  size: number,
  board: string,
  positions: ReadonlySet<string>,
  stone: Stone,
): Candidate[] =>
  allPoints(size).flatMap(point => {
    const judged = judgePlacement(size, board, positions, stone, point);
    return judged.ok ? [{ point, placement: judged.placement }] : [];
  });

const ONE_LIBERTY = 1;
const SAFE_LIBERTIES = 2;

/** The stones of `colour` touching `point` that stand on one liberty, a group reached through two neighbours counted once */
const stonesInAtariAround = (
  size: number,
  board: string,
  colour: Stone,
  point: Point,
): number =>
  new Set(
    neighbours(size, point)
      .filter(next => stoneAt(board, size, next) === colour)
      .map(next => groupAt(board, size, next))
      .filter(group => group.liberties.length === ONE_LIBERTY)
      .flatMap(group => group.stones.map(pointKey)),
  ).size;

/**
 * The stones this placement pulls out of atari: own groups whose one liberty
 * is the point, provided the joined group then breathes.
 */
export const rescuedStones = (
  size: number,
  board: string,
  stone: Stone,
  candidate: Candidate,
): number => {
  const threatened = stonesInAtariAround(size, board, stone, candidate.point);
  if (threatened === 0) return 0;
  const joined = groupAt(candidate.placement.board, size, candidate.point);
  return joined.liberties.length < SAFE_LIBERTIES ? 0 : threatened;
};

/**
 * The enemy stones the stone on `point` leaves with one liberty, read off the
 * board after it landed and its captures were lifted. An enemy group touching
 * the point had two or more liberties before, or the stone captured it.
 */
export const atariStones = (
  size: number,
  after: string,
  stone: Stone,
  point: Point,
): number => stonesInAtariAround(size, after, opponentOf(stone), point);

/** How many neighbours of the point hold `stone` */
export const neighbourStones = (
  size: number,
  board: string,
  point: Point,
  stone: Stone,
): number =>
  neighbours(size, point).filter(next => stoneAt(board, size, next) === stone)
    .length;

/** An empty point every neighbour of which is `stone`'s; filling it costs an eye */
export const isEyeOf = (
  size: number,
  board: string,
  stone: Stone,
  point: Point,
): boolean =>
  neighbours(size, point).every(next => stoneAt(board, size, next) === stone);

type Replayed = {
  board: string;
  /** Stones captured by Black, then by White */
  captures: [number, number];
  /** Every board the game has shown, the empty one first */
  positions: ReadonlySet<string>;
  /** What each move captured, in move order; a pass captures nothing */
  capturedPerMove: number[];
};

const tallied = (
  captures: [number, number],
  stone: Stone,
  lifted: number,
): [number, number] =>
  stone === "B"
    ? [captures[0] + lifted, captures[1]]
    : [captures[0], captures[1] + lifted];

/**
 * The move list played out from the empty board. The position history that
 * superko needs is derived here rather than stored, so a state alone is
 * enough to name the legal moves. A record no rule allows throws: the engine
 * never writes one, so it marks a log nobody played.
 */
export function replayMoves(
  size: number,
  moves: readonly GoMoveRecord[],
): Replayed {
  const start = emptyBoard(size);
  return moves.reduce<Replayed>(
    (game, move, index) => {
      if (move === "pass")
        return { ...game, capturedPerMove: [...game.capturedPerMove, 0] };
      const stone = stoneOf(index);
      const judged = judgePlacement(
        size,
        game.board,
        game.positions,
        stone,
        move,
      );
      if (!judged.ok)
        throw new Error(
          `Move ${index + 1}, ${stoneName(stone)} at ${pointLabel(size, move)}, is ${judged.error}`,
        );
      const { board, captured } = judged.placement;
      return {
        board,
        captures: tallied(game.captures, stone, captured),
        positions: new Set([...game.positions, board]),
        capturedPerMove: [...game.capturedPerMove, captured],
      };
    },
    {
      board: start,
      captures: [0, 0],
      positions: new Set([start]),
      capturedPerMove: [],
    },
  );
}

const countStones = (board: string, stone: Stone): number =>
  [...board].filter(current => current === stone).length;

type EmptyRegion = {
  points: Point[];
  /** The one colour whose stones border the region; null when both do, or none does */
  owner: Stone | null;
};

const ownerOf = (
  board: string,
  size: number,
  edge: readonly Point[],
): Stone | null => {
  const borders = [...new Set(edge.map(next => stoneAt(board, size, next)))];
  const only = borders.length === 1 ? borders[0] : undefined;
  return only !== undefined && isStone(only) ? only : null;
};

/** The connected empty areas of the board, in board order, each with the colour that alone borders it */
const emptyRegions = (board: string, size: number): EmptyRegion[] =>
  components(board, size, isEmpty).map(component => ({
    points: component.inside,
    owner: ownerOf(board, size, component.edge),
  }));

/** Empty points by who alone reaches them; neutral points are reached by both colours, or by neither */
export type Territory = { black: number; white: number; neutral: number };

/** The empty points neither colour alone reaches, in board order: the dame, and the shared liberties of a seki */
export const neutralPoints = (board: string, size: number): Point[] =>
  emptyRegions(board, size).flatMap(region =>
    region.owner === null ? region.points : [],
  );

/** Territory is decided here once: the score, the position summary and the pass gate all read it from here */
export const territoryOf = (board: string, size: number): Territory =>
  emptyRegions(board, size).reduce<Territory>(
    (tally, region) => ({
      black: tally.black + (region.owner === "B" ? region.points.length : 0),
      white: tally.white + (region.owner === "W" ? region.points.length : 0),
      neutral:
        tally.neutral + (region.owner === null ? region.points.length : 0),
    }),
    { black: 0, white: 0, neutral: 0 },
  );

/**
 * Area scoring: each colour's stones plus the empty points only that colour
 * reaches. A region both colours touch, or that no stone touches, is nobody's.
 * Seki gets no special case; its shared liberties are neutral by this rule.
 */
function areaScore(board: string, size: number): GoScore {
  const territory = territoryOf(board, size);
  return {
    black: countStones(board, "B") + territory.black,
    white: countStones(board, "W") + territory.white,
  };
}

/** The area score with komi paid to White, as the game is decided */
export const finalScore = (board: string, size: number): GoScore => {
  const area = areaScore(board, size);
  return { black: area.black, white: area.white + KOMI };
};

/** The index into the player order that a score favours; null for a tie */
export const leaderOf = (score: GoScore): 0 | 1 | null => {
  if (score.black > score.white) return 0;
  if (score.white > score.black) return 1;
  return null;
};
