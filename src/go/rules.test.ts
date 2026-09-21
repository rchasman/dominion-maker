import { describe, expect, it } from "bun:test";
import {
  KOMI,
  atariStones,
  finalScore,
  groupAt,
  groupsOn,
  isSelfAtari,
  judgePlacement,
  judgedPlacements,
  leaderOf,
  lineOf,
  pointLabel,
  replayMoves,
  stoneOf,
  territoryOf,
  threatsAfter,
  threatsTo,
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

  it("counts lines in from the nearest edge", () => {
    expect(lineOf(9, { x: 0, y: 0 })).toBe(1);
    expect(lineOf(9, { x: 8, y: 3 })).toBe(1);
    expect(lineOf(9, { x: 3, y: 5 })).toBe(4);
    expect(lineOf(9, { x: 4, y: 4 })).toBe(5);
    expect(lineOf(19, { x: 9, y: 9 })).toBe(10);
  });
});

describe("the groups and the empty regions of a board", () => {
  const board = boardOf([
    "B . B . . . . . W",
    "B B B . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . W B . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);

  it("lists every group in board order with its colour and liberties", () => {
    expect(
      groupsOn(board, SIZE).map(group => ({
        stone: group.stone,
        stones: group.stones.length,
        first: pointLabel(SIZE, group.stones[0] ?? { x: -1, y: -1 }),
        liberties: group.liberties.length,
      })),
    ).toEqual([
      { stone: "B", stones: 5, first: "A9", liberties: 6 },
      { stone: "W", stones: 1, first: "J9", liberties: 2 },
      { stone: "W", stones: 1, first: "E5", liberties: 3 },
      { stone: "B", stones: 1, first: "F5", liberties: 3 },
    ]);
  });

  it("gives each empty region to the one colour that borders it, or to nobody", () => {
    // B9 is walled in by Black alone; the rest touches both colours
    expect(territoryOf(board, SIZE)).toEqual({
      black: 1,
      white: 0,
      neutral: 72,
    });
    expect(territoryOf(EMPTY_BOARD, SIZE)).toEqual({
      black: 0,
      white: 0,
      neutral: 81,
    });
  });

  it("counts the enemy stones a placed stone leaves on one liberty", () => {
    // Black on D5 and F5 flank White's E5; E6 leaves it E4 alone
    const flanked = boardOf([
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . B W B . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    const judged = judge(flanked, "B", 4, 3);
    if (!judged.ok) throw new Error(judged.error);
    expect(atariStones(SIZE, judged.placement.board, "B", { x: 4, y: 3 })).toBe(
      1,
    );
    const elsewhere = judge(flanked, "B", 0, 0);
    if (!elsewhere.ok) throw new Error(elsewhere.error);
    expect(
      atariStones(SIZE, elsewhere.placement.board, "B", { x: 0, y: 0 }),
    ).toBe(0);
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
      judgedPlacements(SIZE, EMPTY_BOARD, new Set([EMPTY_BOARD]), "B"),
    ).toHaveLength(81);
    const one = judge(EMPTY_BOARD, "B", 4, 4);
    if (!one.ok) throw new Error(one.error);
    expect(
      judgedPlacements(SIZE, one.placement.board, NO_HISTORY, "W"),
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

describe("one move of reading ahead", () => {
  const threats = (board: string, stone: "B" | "W") =>
    threatsTo(SIZE, board, new Set([board]), stone);

  /** Black's B9 and its D9-E9 pair both hang by C9 */
  const SHARED_LIBERTY = boardOf([
    "W B . B B W . . .",
    "W W W W W W . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);

  /**
   * Black's eight stones breathe at B9, an eye White may not fill, and at
   * E9, where a White stone would stand on F9 alone and capture nothing.
   */
  const SELF_ATARI_REPLY = boardOf([
    "B . B B . . W . .",
    "B B B B B W W . .",
    "W W W W W W . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ]);

  it("names a self-atari by the liberties left and the stones lifted alone", () => {
    expect(isSelfAtari({ libertiesAfter: 1, captures: 0 })).toBe(true);
    expect(isSelfAtari({ libertiesAfter: 1, captures: 1 })).toBe(false);
    expect(isSelfAtari({ libertiesAfter: 2, captures: 0 })).toBe(false);
  });

  it("counts every stone one enemy placement lifts, across the groups hanging by that point", () => {
    expect(
      groupsOn(SHARED_LIBERTY, SIZE).map(group => [
        group.stone,
        group.stones.length,
        group.liberties.length,
      ]),
    ).toEqual([
      ["W", 8, 9],
      ["B", 1, 1],
      ["B", 2, 1],
    ]);
    expect(threats(SHARED_LIBERTY, "B")).toEqual({ exposed: 3, threatened: 0 });
    expect(threats(SHARED_LIBERTY, "W")).toEqual({ exposed: 0, threatened: 0 });
  });

  it("holds the enemy to superko, so a ko stone just taken is not exposed", () => {
    // Black has just taken the ko at D8; White's retake at C8 repeats the position
    const game = replayMoves(SIZE, [
      point(1, 1),
      point(3, 0),
      point(2, 0),
      point(3, 2),
      point(2, 2),
      point(4, 1),
      point(7, 7),
      point(2, 1),
      point(3, 1),
    ]);
    expect(groupAt(game.board, SIZE, { x: 3, y: 1 }).liberties).toEqual([
      { x: 2, y: 1 },
    ]);
    expect(threatsTo(SIZE, game.board, game.positions, "B")).toEqual({
      exposed: 0,
      threatened: 0,
    });
    // With no history the retake is a plain capture of the ko stone, and it
    // also leaves Black's C9 stone, breathing at B9 and C8, on one liberty
    expect(threatsTo(SIZE, game.board, NO_HISTORY, "B")).toEqual({
      exposed: 1,
      threatened: 1,
    });
  });

  it("does not call a group threatened by a stone the rules refuse or that would stand in atari itself", () => {
    expect(judge(SELF_ATARI_REPLY, "W", 1, 0)).toEqual({
      ok: false,
      error: "suicide",
    });
    const atE9 = judge(SELF_ATARI_REPLY, "W", 4, 0);
    if (!atE9.ok) throw new Error(atE9.error);
    expect(atE9.placement.captured).toBe(0);
    expect(
      groupAt(atE9.placement.board, SIZE, { x: 4, y: 0 }).liberties,
    ).toEqual([{ x: 5, y: 0 }]);
    expect(threats(SELF_ATARI_REPLY, "B")).toEqual({
      exposed: 0,
      threatened: 0,
    });
  });

  it("calls a group on two liberties threatened when the enemy may fill one soundly", () => {
    // Black's A9-A8 pair breathes at B9 and B8; White on B8 stands on two liberties
    const board = boardOf([
      "B . . . . . . . .",
      "B . . . . . . . .",
      "W . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
      ". . . . . . . . .",
    ]);
    expect(threats(board, "B")).toEqual({ exposed: 0, threatened: 2 });
    // White's lone A7 stone breathes at B7 and A6, both sound for Black
    expect(threats(board, "W")).toEqual({ exposed: 0, threatened: 1 });
  });
});

describe("reading ahead from each candidate", () => {
  /** A linear congruential generator, so the boards are the same on every run */
  const seeded = (seed: number): (() => number) => {
    const state = { value: seed >>> 0 };
    return () => {
      state.value = (state.value * 1664525 + 1013904223) >>> 0;
      return state.value / 4294967296;
    };
  };

  /** Random legal play, self-atari and eye fills included, so groups die and liberties change */
  const randomMoves = (
    size: number,
    count: number,
    seed: number,
  ): GoMoveRecord[] => {
    const next = seeded(seed);
    return Array.from({ length: count }).reduce<GoMoveRecord[]>(moves => {
      const { board, positions } = replayMoves(size, moves);
      const legal = judgedPlacements(
        size,
        board,
        positions,
        stoneOf(moves.length),
      );
      const pick = legal[Math.floor(next() * legal.length)];
      return pick === undefined ? moves : [...moves, pick.point];
    }, []);
  };

  it("reads the same threats as judging the board after each stone afresh, on 50 random boards", () => {
    Array.from({ length: 50 }, (_, index) => index).map(index => {
      const size = index % 5 === 0 ? 13 : 9;
      const moves = randomMoves(size, 20 + ((index * 7) % 60), index + 1);
      const game = replayMoves(size, moves);
      const stone = stoneOf(moves.length);
      const readAfter = threatsAfter(size, game.board, game.positions, stone);
      judgedPlacements(size, game.board, game.positions, stone).map(candidate =>
        expect(readAfter(candidate)).toEqual(
          threatsTo(size, candidate.placement.board, game.positions, stone),
        ),
      );
    });
  });
});
