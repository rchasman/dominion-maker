import { describe, expect, it } from "bun:test";
import {
  describePass,
  describeScore,
  factsOf,
  legalCandidates,
  offeredMoves,
  passWinsNow,
  placementFacts,
  positionFacts,
  type PlacementFacts,
} from "./candidates";
import {
  isEyeOf,
  isSelfAtari,
  judgePlacement,
  pointLabel,
  stoneOf,
} from "./rules";
import type { GoMove, GoMoveRecord, GoState } from "./shape";
import { goStateAfter, goStateFromRows, placedStone } from "./test-helpers";

const BLACK = "b";
const WHITE = "w";
const SIZE = 9;
const PASS: GoMove = { kind: "pass", label: "pass" };

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

const after = (moves: GoMoveRecord[]): GoState =>
  goStateAfter([BLACK, WHITE], moves);

const stateOf = (rows: string[], moves: GoMoveRecord[] = []): GoState =>
  goStateFromRows([BLACK, WHITE], rows, moves);

/** The facts behind one move asked about directly, offered or not */
const factsFor = (state: GoState, move: GoMove): PlacementFacts => {
  const [judged] = factsOf(state, [move]);
  if (judged === undefined || judged.facts === null)
    throw new Error(`${move.label} has no facts`);
  return judged.facts;
};

/**
 * A seki in the top-left: White's ring and Black's D7 stone share C7 and E7
 * as their only liberties, so whoever fills one hands the other the capture.
 * The rest of the board is Black's, with room to fill.
 */
const SEKI = [
  "B B B B B B B B B",
  "B W W W W W B B B",
  "B W . B . W B . .",
  "B W W W W W B . .",
  "B B B B B B B . .",
  ". . . . . . . . .",
  ". . . . . . . . .",
  ". . . . . . . . .",
  ". . . . . . . . .",
];

const labels = (moves: GoMove[]): string[] => moves.map(move => move.label);

const factsAt = (state: GoState, label: string): PlacementFacts | null => {
  const judged = factsOf(state, offeredMoves(state)).find(
    entry => entry.move.label === label,
  );
  if (judged === undefined) throw new Error(`${label} is not offered`);
  return judged.facts;
};

/** Two White stones at E5-F5 hang by G5, and White's lone A9 stone hangs by A8 */
const CAPTURES: GoMoveRecord[] = [
  point(3, 4),
  point(4, 4),
  point(4, 3),
  point(5, 4),
  point(5, 3),
  point(0, 0),
  point(4, 5),
  point(8, 8),
  point(5, 5),
  point(8, 7),
  point(1, 0),
  point(8, 6),
];

/** Black's E5-F5 pair hangs by G5 */
const RESCUE: GoMoveRecord[] = [
  point(4, 4),
  point(3, 4),
  point(5, 4),
  point(4, 3),
  point(7, 7),
  point(5, 3),
  point(8, 6),
  point(4, 5),
  point(7, 8),
  point(5, 5),
];

/** Black's wall on column E faces White's on column F; every empty point is one side's */
const WALLS: GoMoveRecord[] = Array.from({ length: SIZE * 2 }, (_, index) =>
  point(index % 2 === 0 ? 4 : 5, Math.floor(index / 2)),
);

describe("placement facts", () => {
  it("counts the line, the liberties and the neighbours on an empty board", () => {
    const state = after([]);
    expect(factsAt(state, "D4")).toEqual({
      line: 4,
      captures: 0,
      libertiesAfter: 4,
      rescues: 0,
      atari: 0,
      touchesOwn: 0,
      touchesEnemy: 0,
      exposed: 0,
      threatened: 0,
    });
    expect(factsAt(state, "A9")).toMatchObject({ line: 1, libertiesAfter: 2 });
    expect(factsAt(state, "E5")).toMatchObject({ line: 5 });
  });

  it("counts the stones a placement captures and the enemy stones it touches", () => {
    const state = after(CAPTURES);
    expect(factsAt(state, "G5")).toMatchObject({
      captures: 2,
      touchesOwn: 0,
      touchesEnemy: 1,
    });
    expect(factsAt(state, "A8")).toMatchObject({ captures: 1 });
    expect(factsAt(state, "H9")).toMatchObject({ captures: 0 });
  });

  it("counts the own stones a placement saves from atari", () => {
    const state = after(RESCUE);
    expect(factsAt(state, "G5")).toMatchObject({
      line: 3,
      rescues: 2,
      libertiesAfter: 3,
      touchesOwn: 1,
    });
    expect(factsAt(state, "A1")).toMatchObject({ rescues: 0 });
  });

  it("counts the enemy stones a placement leaves with one liberty", () => {
    // White's E5 stone has Black on D5 and F5; E6 leaves it E4 alone
    const state = after([point(3, 4), point(4, 4), point(5, 4), point(7, 8)]);
    expect(factsAt(state, "E6")).toMatchObject({
      atari: 1,
      captures: 0,
      libertiesAfter: 3,
    });
    expect(factsAt(state, "E3")).toMatchObject({ atari: 0 });
  });

  it("counts a captured group as lifted, not as left in atari", () => {
    const state = after(CAPTURES);
    expect(factsAt(state, "G5")).toMatchObject({ captures: 2, atari: 0 });
  });

  it("judges a placement that was not offered when asked directly", () => {
    // Black's A8 would sit between White's A7 and B8 with A9 as its one liberty
    const state = after([point(4, 4), point(0, 2), point(5, 4), point(1, 1)]);
    const candidate = legalCandidates(state).find(
      entry => pointLabel(SIZE, entry.point) === "A8",
    );
    if (candidate === undefined) throw new Error("A8 is not legal");
    const facts = placementFacts(
      SIZE,
      state.board,
      new Set([state.board]),
      "B",
    )(candidate);
    expect(facts).toMatchObject({
      libertiesAfter: 1,
      captures: 0,
      touchesEnemy: 2,
      exposed: 1,
    });
    expect(isSelfAtari(facts)).toBe(true);
  });

  it("refuses to describe a move the rules do not allow", () => {
    const state = after([point(3, 5)]);
    expect(() =>
      factsOf(state, [{ kind: "place", x: 3, y: 5, label: "D4" }]),
    ).toThrow("D4 is occupied");
  });
});

describe("one move ahead", () => {
  /** Black's A9 hangs by A8 with White on B9 */
  const CORNER = [
    "B W . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ];

  /**
   * A7 lifts White's A9-A8 pair and stands on A8 alone, a liberty White may
   * fill at once: two stones came off, so the retake repeats no position.
   */
  const SNAPBACK = [
    "W B . . . . . . .",
    "W B . . . . . . .",
    ". W . . . . . . .",
    "W . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ];

  /** Black lives with two one-point eyes at B9 and D9, both suicide for White */
  const TWO_EYES = [
    "B . B . B W . . .",
    "B B B B B W . . .",
    "W W W W W W . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
    ". . . . . . . . .",
  ];

  it("counts the own stones a tenuki leaves the opponent to capture, and the rescue that saves them", () => {
    const state = stateOf(CORNER);
    expect(factsFor(state, placedStone(4, 4, "E5"))).toMatchObject({
      exposed: 1,
      threatened: 0,
    });
    expect(factsFor(state, placedStone(0, 1, "A8"))).toMatchObject({
      rescues: 1,
      libertiesAfter: 2,
      exposed: 0,
      threatened: 2,
    });
  });

  it("sees a group in atari before the move and the pair the opponent could capture instead of the rescue", () => {
    const state = after(RESCUE);
    expect(positionFacts(state).threats).toEqual({
      exposed: 2,
      threatened: 0,
    });
    expect(factsFor(state, placedStone(6, 4, "G5"))).toMatchObject({
      rescues: 2,
      exposed: 0,
    });
    expect(factsFor(state, placedStone(0, 8, "A1"))).toMatchObject({
      rescues: 0,
      exposed: 2,
      threatened: 1,
    });
  });

  it("does not count a ko stone the opponent may not retake at once", () => {
    // Black takes the ko at D8; White's retake at C8 would repeat the position
    const state = after([
      point(1, 1),
      point(3, 0),
      point(2, 0),
      point(3, 2),
      point(2, 2),
      point(4, 1),
      point(7, 7),
      point(2, 1),
    ]);
    expect(factsFor(state, placedStone(3, 1, "D8"))).toMatchObject({
      captures: 1,
      libertiesAfter: 1,
      exposed: 0,
      threatened: 0,
    });
    // Ignoring the ko leaves C9 hanging by B9, which White may fill
    expect(factsFor(state, placedStone(4, 4, "E5"))).toMatchObject({
      exposed: 1,
      threatened: 1,
    });
  });

  it("counts a capturing stone the opponent may take straight back", () => {
    expect(factsFor(stateOf(SNAPBACK), placedStone(0, 2, "A7"))).toMatchObject({
      captures: 2,
      libertiesAfter: 1,
      exposed: 1,
      threatened: 0,
    });
  });

  it("does not call a group on two liberties threatened when the opponent may fill neither", () => {
    const state = stateOf(TWO_EYES);
    expect(positionFacts(state).threats).toEqual({
      exposed: 0,
      threatened: 0,
    });
    expect(factsFor(state, placedStone(4, 4, "E5"))).toMatchObject({
      exposed: 0,
      threatened: 0,
    });
  });

  it("calls a corner stone threatened on an empty board and an inner stone safe", () => {
    const state = after([]);
    expect(factsAt(state, "A9")).toMatchObject({
      libertiesAfter: 2,
      exposed: 0,
      threatened: 1,
    });
    expect(factsAt(state, "B9")).toMatchObject({ threatened: 0 });
    expect(factsAt(state, "D4")).toMatchObject({ exposed: 0, threatened: 0 });
  });
});

describe("the offered moves", () => {
  it("offers every point of the empty board and no pass", () => {
    const offered = offeredMoves(after([]));
    expect(offered).toHaveLength(SIZE * SIZE);
    expect(labels(offered)).not.toContain("pass");
    expect(offered[0]).toEqual({ kind: "place", x: 0, y: 0, label: "A9" });
  });

  it("withholds the pass while only one colour is on the board", () => {
    // A lone Black stone borders every empty point, which settles nothing
    const state = after([point(3, 5)]);
    expect(positionFacts(state).territory.neutral).toBe(0);
    expect(labels(offeredMoves(state))).not.toContain("pass");
    expect(offeredMoves(state)).toHaveLength(SIZE * SIZE - 1);
  });

  it("leaves out a self-atari that captures nothing", () => {
    const state = after([point(4, 4), point(0, 2), point(5, 4), point(1, 1)]);
    expect(
      legalCandidates(state).map(c => pointLabel(SIZE, c.point)),
    ).toContain("A8");
    expect(labels(offeredMoves(state))).not.toContain("A8");
    expect(labels(offeredMoves(state))).toContain("A9");
  });

  it("keeps a self-atari that captures, as a ko capture does", () => {
    // Black takes the ko at C8 with a stone that stands on one liberty
    const state = after([
      point(1, 1),
      point(3, 0),
      point(2, 0),
      point(3, 2),
      point(2, 2),
      point(4, 1),
      point(7, 7),
      point(2, 1),
    ]);
    expect(factsAt(state, "D8")).toMatchObject({
      captures: 1,
      libertiesAfter: 1,
    });
  });

  it("leaves out a fill of an own eye", () => {
    // A9 has Black on B9 and A8, so it is Black's eye and nothing else
    const state = after([point(1, 0), point(7, 8), point(0, 1), point(7, 7)]);
    expect(
      legalCandidates(state).map(c => pointLabel(SIZE, c.point)),
    ).toContain("A9");
    expect(labels(offeredMoves(state))).not.toContain("A9");
    expect(labels(offeredMoves(state))).toContain("B8");
  });

  it("keeps an eye fill that connects a group out of atari", () => {
    // Black's A9 hangs by B9; B9 touches only Black stones and joins A9 to C9 and B8
    const state = after([
      point(0, 0),
      point(0, 1),
      point(2, 0),
      point(7, 8),
      point(1, 1),
      point(7, 7),
    ]);
    expect(isEyeOf(SIZE, state.board, "B", { x: 1, y: 0 })).toBe(true);
    expect(labels(offeredMoves(state))).toContain("B9");
    expect(factsAt(state, "B9")).toMatchObject({
      rescues: 1,
      libertiesAfter: 3,
      touchesOwn: 3,
    });
  });

  it("offers the pass when the opponent has passed and the mover leads", () => {
    const state = after([point(3, 5), "pass"]);
    expect(passWinsNow(state)).toBe(true);
    expect(labels(offeredMoves(state))).toContain("pass");
    expect(offeredMoves(state).at(-1)).toEqual(PASS);
  });

  it("withholds the pass when the opponent has passed and the mover is behind", () => {
    // Two Black stones against one White stone and komi, every empty point neutral
    const state = after([point(4, 4), point(2, 6), point(6, 2), "pass"]);
    expect(passWinsNow(state)).toBe(false);
    expect(labels(offeredMoves(state))).not.toContain("pass");
  });

  it("withholds the pass while a neutral point remains", () => {
    expect(passWinsNow(after([point(3, 5), point(2, 6)]))).toBe(false);
    expect(
      labels(offeredMoves(after([point(3, 5), point(2, 6)]))),
    ).not.toContain("pass");
    expect(labels(offeredMoves(after(CAPTURES)))).not.toContain("pass");
  });

  it("offers the pass once every empty point is one side's", () => {
    const state = after(WALLS);
    expect(positionFacts(state).territory).toEqual({
      black: 36,
      white: 27,
      neutral: 0,
    });
    expect(passWinsNow(state)).toBe(false);
    expect(labels(offeredMoves(state))).toContain("pass");
    expect(offeredMoves(state)).toHaveLength(SIZE * SIZE - SIZE * 2 + 1);
  });

  it("offers both sides the pass in a seki, where the shared liberties stay neutral", () => {
    const black = stateOf(SEKI);
    const white = stateOf(SEKI, ["pass"]);
    expect(positionFacts(black).territory.neutral).toBe(2);
    [black, white].map(state => {
      expect(passWinsNow(state)).toBe(false);
      const offered = labels(offeredMoves(state));
      expect(offered).not.toContain("C7");
      expect(offered).not.toContain("E7");
      expect(offered).toContain("A4");
      expect(offered.at(-1)).toBe("pass");
    });
  });

  it("offers the pass and the leftovers when no defensible placement remains", () => {
    // Black lives with two eyes at B8 and D8; its lone F5 stone breathes at E5
    // and G5 inside White's sea, so every legal Black stone is a self-atari
    // or an eye fill while two neutral points remain.
    const state = stateOf([
      "B B B B W W W W W",
      "B . B . B W W W W",
      "B B B B B W W W W",
      "W W W W W W W W W",
      "W W W W . B . W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
    ]);
    expect(positionFacts(state).territory.neutral).toBe(2);
    expect(passWinsNow(state)).toBe(false);
    expect(labels(offeredMoves(state))).toEqual([
      "B8",
      "D8",
      "E5",
      "G5",
      "pass",
    ]);
  });

  it("offers only the pass when no placement is legal", () => {
    // Both empty corners are suicide for Black while the other stays a liberty
    const state = stateOf([
      ". W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W W",
      "W W W W W W W W .",
    ]);
    expect(legalCandidates(state)).toEqual([]);
    expect(offeredMoves(state)).toEqual([PASS]);
  });

  it("offers every legal placement the rules cannot fault, and nothing else", () => {
    [after(CAPTURES), after(RESCUE), after(WALLS)].map(state => {
      const stone = stoneOf(state.moves.length);
      const offered = labels(offeredMoves(state)).filter(
        label => label !== "pass",
      );
      const legal = legalCandidates(state);
      const legalLabels = legal.map(c => pointLabel(SIZE, c.point));
      offered.map(label => expect(legalLabels).toContain(label));
      const factsFor = placementFacts(
        SIZE,
        state.board,
        new Set([state.board]),
        stone,
      );
      legal.map(candidate => {
        const facts = factsFor(candidate);
        const faultless =
          !isSelfAtari(facts) &&
          (facts.rescues > 0 ||
            !isEyeOf(SIZE, state.board, stone, candidate.point));
        expect(offered.includes(pointLabel(SIZE, candidate.point))).toBe(
          faultless,
        );
      });
    });
  });

  it("offers only placements the rules allow right now", () => {
    const state = after(CAPTURES);
    const stone = stoneOf(state.moves.length);
    offeredMoves(state).map(move => {
      if (move.kind === "pass") return;
      expect(
        judgePlacement(SIZE, state.board, new Set([state.board]), stone, move)
          .ok,
      ).toBe(true);
    });
  });
});

describe("the position facts", () => {
  it("scores the board, sorts the empty points and lists every group", () => {
    const facts = positionFacts(after([point(3, 5), point(5, 3)]));
    expect(facts.score).toEqual({ black: 1, white: 8.5 });
    expect(describeScore(facts.score)).toBe(
      "Black 1 to White 8.5 with komi counted: White leads by 7.5",
    );
    expect(facts.territory).toEqual({ black: 0, white: 0, neutral: 79 });
    expect(facts.groups).toEqual([
      { stone: "B", stones: 1, around: "D4", liberties: 4 },
      { stone: "W", stones: 1, around: "F6", liberties: 4 },
    ]);
  });

  it("names a group by its first stone in board order and counts its liberties", () => {
    const facts = positionFacts(after(RESCUE));
    expect(facts.groups).toContainEqual({
      stone: "B",
      stones: 2,
      around: "E5",
      liberties: 1,
    });
    expect(facts.groups).toContainEqual({
      stone: "B",
      stones: 2,
      around: "H2",
      liberties: 5,
    });
    expect(facts.groups.filter(group => group.stone === "W")).toHaveLength(3);
  });

  it("counts an eye as its owner's territory", () => {
    const facts = positionFacts(
      after([point(1, 0), point(7, 8), point(0, 1), point(7, 7)]),
    );
    expect(facts.territory).toEqual({ black: 1, white: 0, neutral: 76 });
  });

  it("calls a tied score tied", () => {
    expect(describeScore({ black: 40.5, white: 40.5 })).toBe(
      "Black 40.5 to White 40.5 with komi counted: the game is tied",
    );
  });
});

describe("the pass", () => {
  it("says what it does and what the game would score", () => {
    expect(describePass(after([]))).toBe(
      "ends the game if the opponent passes too; score would be Black 0 to White 7.5 with komi counted: White leads by 7.5",
    );
    expect(describePass(after([point(3, 5), "pass"]))).toBe(
      "ends the game now, scored as it stands: Black 81 to White 7.5 with komi counted: Black leads by 73.5",
    );
  });
});
