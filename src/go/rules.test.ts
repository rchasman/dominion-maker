import { describe, expect, it } from "bun:test";
import {
  KOMI,
  finalScore,
  groupAt,
  judgePlacement,
  leaderOf,
  legalPlacements,
  neighbours,
  pointLabel,
  replayMoves,
} from "./rules";
import type { GoMoveRecord } from "./shape";

const SIZE = 9;
const EMPTY_BOARD = ".".repeat(SIZE * SIZE);

/** The area score before komi, so a test reads the counts the board shows */
const areaScore = (board: string, size: number) => {
  const score = finalScore(board, size);
  return { black: score.black, white: score.white - KOMI };
};

/** Rows from the top edge down, spaces ignored, so a board reads as it is drawn */
const boardOf = (rows: string[]): string =>
  rows.map(row => row.replaceAll(" ", "")).join("");

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

const NO_HISTORY: ReadonlySet<string> = new Set();

const judge = (board: string, stone: "B" | "W", x: number, y: number) =>
  judgePlacement(SIZE, board, NO_HISTORY, stone, { x, y });

describe("Go coordinates", () => {
  it("labels columns without I and counts rows from the bottom", () => {
    expect(pointLabel(9, { x: 0, y: 8 })).toBe("A1");
    expect(pointLabel(9, { x: 3, y: 5 })).toBe("D4");
    expect(pointLabel(9, { x: 8, y: 0 })).toBe("J9");
    expect(pointLabel(19, { x: 8, y: 0 })).toBe("J19");
    expect(pointLabel(19, { x: 18, y: 18 })).toBe("T1");
  });

  it("gives a corner two neighbours, an edge three and the middle four", () => {
    expect(neighbours(9, { x: 0, y: 0 })).toHaveLength(2);
    expect(neighbours(9, { x: 4, y: 0 })).toHaveLength(3);
    expect(neighbours(9, { x: 4, y: 4 })).toHaveLength(4);
    expect(neighbours(9, { x: 8, y: 8 })).toEqual([
      { x: 8, y: 7 },
      { x: 7, y: 8 },
    ]);
  });
});

describe("a stone landing on the board", () => {
  it("lifts an enemy stone whose last liberty it fills", () => {
    const board = boardOf([
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . B . . . . .",
      ". . B W . . . . .",
      ". . . B . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    const judged = judge(board, "B", 4, 4);
    if (!judged.ok) throw new Error(judged.error);
    expect(judged.placement.captured).toBe(1);
    expect(judged.placement.board.includes("W")).toBe(false);
    expect(
      groupAt(judged.placement.board, SIZE, { x: 4, y: 4 }).stones,
    ).toHaveLength(1);
  });

  it("lifts every enemy group left without a liberty, counting each stone once", () => {
    // Two white stones share the corner point with a third; Black's stone
    // has no liberty of its own until they are gone, so this is not suicide.
    const board = boardOf([
      ". W W B . . . . .",
      "W B B . . . . . .",
      "B . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    const judged = judge(board, "B", 0, 0);
    if (!judged.ok) throw new Error(judged.error);
    expect(judged.placement.captured).toBe(3);
    expect(judged.placement.board.startsWith("B..B")).toBe(true);
  });

  it("refuses a stone with no liberty that captures nothing", () => {
    const board = boardOf([
      ". W . . . . . . .",
      "W . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    expect(judge(board, "B", 0, 0)).toEqual({ ok: false, error: "suicide" });
    expect(judge(board, "W", 0, 0).ok).toBe(true);
  });

  it("refuses an occupied point and a point off the board", () => {
    const board = boardOf([
      "B . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    expect(judge(board, "W", 0, 0)).toEqual({ ok: false, error: "occupied" });
    expect(judge(board, "W", 9, 0)).toEqual({
      ok: false,
      error: "off the board",
    });
    expect(judge(board, "W", 0, -1)).toEqual({
      ok: false,
      error: "off the board",
    });
  });

  it("offers every empty point on an open board and no occupied one", () => {
    expect(
      legalPlacements(SIZE, EMPTY_BOARD, new Set([EMPTY_BOARD]), "B"),
    ).toHaveLength(81);
    const one = judge(EMPTY_BOARD, "B", 4, 4);
    if (!one.ok) throw new Error(one.error);
    expect(
      legalPlacements(SIZE, one.placement.board, NO_HISTORY, "W"),
    ).toHaveLength(80);
  });
});

describe("positional superko", () => {
  // Black takes the ko at (3,1); White may not take it straight back.
  const KO: GoMoveRecord[] = [
    point(1, 1),
    point(3, 0),
    point(2, 0),
    point(3, 2),
    point(2, 2),
    point(4, 1),
    point(7, 7),
    point(2, 1),
    point(3, 1),
  ];

  it("refuses the immediate recapture of a single-stone ko", () => {
    const game = replayMoves(SIZE, KO);
    expect(game.captures).toEqual([1, 0]);
    expect(
      judgePlacement(SIZE, game.board, game.positions, "W", { x: 2, y: 1 }),
    ).toEqual({ ok: false, error: "a repeat of an earlier position" });
    expect(() => replayMoves(SIZE, [...KO, point(2, 1)])).toThrow(
      /Move 10, White at C8, is a repeat of an earlier position/,
    );
  });

  it("allows the recapture once a move elsewhere has changed the board", () => {
    const game = replayMoves(SIZE, [...KO, point(7, 6), point(6, 6)]);
    const retaken = judgePlacement(SIZE, game.board, game.positions, "W", {
      x: 2,
      y: 1,
    });
    if (!retaken.ok) throw new Error(retaken.error);
    expect(retaken.placement.captured).toBe(1);
  });

  it("refuses a return to a position through a longer cycle", () => {
    // Sending two, returning one: Black throws in at A9, White lifts two
    // stones at C9, and Black's capture at B9 would rebuild the board that
    // stood after White's filler move. A simple ko rule lets this through.
    const opening: GoMoveRecord[] = [
      point(1, 0),
      point(0, 1),
      point(3, 0),
      point(1, 1),
      point(2, 1),
      point(8, 8),
    ];
    const before = replayMoves(SIZE, opening).board;
    const cycle = [...opening, point(0, 0), point(2, 0)];
    const game = replayMoves(SIZE, cycle);
    expect(game.captures).toEqual([0, 2]);
    const returning = judgePlacement(SIZE, game.board, game.positions, "B", {
      x: 1,
      y: 0,
    });
    expect(returning).toEqual({
      ok: false,
      error: "a repeat of an earlier position",
    });
    // Without the history the same stone is a plain capture back to `before`
    const unchecked = judgePlacement(SIZE, game.board, NO_HISTORY, "B", {
      x: 1,
      y: 0,
    });
    if (!unchecked.ok) throw new Error(unchecked.error);
    expect(unchecked.placement.board).toBe(before);
  });

  it("counts the empty board as a position the game has shown", () => {
    const game = replayMoves(SIZE, []);
    expect(game.positions.has(EMPTY_BOARD)).toBe(true);
    expect(game.board).toBe(EMPTY_BOARD);
    expect(game.capturedPerMove).toEqual([]);
  });

  it("reports what each move captured and skips a pass", () => {
    const game = replayMoves(SIZE, [...KO, "pass"]);
    expect(game.capturedPerMove).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
    expect(game.board).toBe(replayMoves(SIZE, KO).board);
  });
});

describe("area scoring", () => {
  it("gives each colour its stones and the points only it encloses", () => {
    // Black's wall on column E, White's on column F: everything left of E
    // is Black's, everything right of F is White's, and no point is shared.
    const board = boardOf(
      Array.from({ length: SIZE }, () => ". . . . B W . . ."),
    );
    expect(areaScore(board, SIZE)).toEqual({ black: 45, white: 36 });
    expect(finalScore(board, SIZE)).toEqual({ black: 45, white: 36 + KOMI });
    expect(leaderOf(finalScore(board, SIZE))).toBe(0);
  });

  it("gives a region both colours touch to nobody", () => {
    const board = boardOf([
      "B . . . . . . . W",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    expect(areaScore(board, SIZE)).toEqual({ black: 1, white: 1 });
    expect(leaderOf(finalScore(board, SIZE))).toBe(1);
  });

  it("gives an empty board to nobody, so komi alone decides it", () => {
    expect(areaScore(EMPTY_BOARD, SIZE)).toEqual({ black: 0, white: 0 });
    expect(finalScore(EMPTY_BOARD, SIZE)).toEqual({
      black: 0,
      white: KOMI,
    });
  });

  it("leaves a trapped stone standing and the points beside it neutral", () => {
    // A white stone shut inside Black's corner still stands on the board, so
    // under area scoring it counts for White and the two empty points it
    // touches belong to nobody. Dead stones are lifted by capturing them.
    const board = boardOf([
      "W . B . . . . . .",
      ". B . . . . . . .",
      "B . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    const score = areaScore(board, SIZE);
    expect(score.white).toBe(1);
    // Three stones plus the 75 points only Black's wall reaches
    expect(score.black).toBe(78);
    expect(SIZE * SIZE - score.black - score.white).toBe(2);
  });

  it("calls an equal total a tie with no leader", () => {
    expect(leaderOf({ black: 40.5, white: 40.5 })).toBeNull();
    expect(leaderOf({ black: 40, white: 40.5 })).toBe(1);
    expect(leaderOf({ black: 41, white: 40.5 })).toBe(0);
  });
});
