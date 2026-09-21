import { describe, expect, it } from "bun:test";
import {
  JEV_MAX_OPTIONS,
  jevOptionKey,
  readJevChoice,
  type JevChoiceQuestion,
} from "../agent/jev-protocol";
import { goGame } from "./definition";
import { goEvaluate, goJevQuestion, goJevState } from "./jev";
import type { GoMove, GoMoveRecord, GoState } from "./shape";
import { goStateAfter } from "./test-helpers";

const BLACK = "b";
const WHITE = "w";
const OPENING_MOVES = 82;
const FULL_BOARD_OPENING_MOVES = 362;

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

const after = (moves: GoMoveRecord[]): GoState =>
  goStateAfter([BLACK, WHITE], moves);

const afterOnFullBoard = (moves: GoMoveRecord[]): GoState =>
  goStateAfter([BLACK, WHITE], moves, 19);

const questionFor = (state: GoState) =>
  goJevQuestion(state, goGame.legalMoves(state, BLACK));

const descriptionOf = (
  question: JevChoiceQuestion<GoMove>,
  label: string,
): string | null | undefined =>
  question.options.find(option => option.move.label === label)?.description;

describe("goJevQuestion", () => {
  it("offers every legal point and the pass once, keyed by table number and label", () => {
    const state = after([]);
    const moves = goGame.legalMoves(state, BLACK);
    const question = goJevQuestion(state, moves);
    expect(question.options).toHaveLength(OPENING_MOVES);
    expect(question.options.map(option => option.key)).toEqual(
      moves.map((move, index) => `${index + 1}. ${move.label}`),
    );
    expect(new Set(question.options.map(option => option.key)).size).toBe(
      OPENING_MOVES,
    );
    expect(question.options.map(option => option.move)).toEqual(moves);
  });

  it("states the line, the liberties and the neighbours of a stone on an empty board", () => {
    const question = questionFor(after([]));
    expect(descriptionOf(question, "D4")).toBe(
      "Black stone at D4, on line 4. Captures nothing. The group it joins would have 4 liberties. Touches 0 own stones and 0 enemy stones",
    );
    expect(descriptionOf(question, "A9")).toContain("on line 1");
    expect(descriptionOf(question, "A9")).toContain("would have 2 liberties");
  });

  it("states how many stones a placement captures", () => {
    // White's E5-F5 pair hangs by G5; White's lone A9 stone hangs by A8.
    const question = questionFor(
      after([
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
      ]),
    );
    expect(descriptionOf(question, "G5")).toContain("Captures 2 White stones");
    expect(descriptionOf(question, "A8")).toContain("Captures 1 White stone");
    expect(descriptionOf(question, "G5")).toContain(
      "Touches 0 own stones and 1 enemy stone",
    );
    expect(descriptionOf(question, "H9")).toContain("Captures nothing");
  });

  it("states when a placement saves its own group from atari", () => {
    // Black's E5-F5 pair hangs by G5.
    const question = questionFor(
      after([
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
      ]),
    );
    expect(descriptionOf(question, "G5")).toContain(
      "Saves 2 own stones from atari",
    );
    expect(descriptionOf(question, "G5")).toContain(
      "Touches 1 own stone and 0 enemy stones",
    );
    expect(descriptionOf(question, "A1")).not.toContain("Saves");
  });

  it("counts the liberties of the group a stone joins and warns when it lands in atari", () => {
    // A8 and B9 are Black's stones; A9 joins them into one group of three.
    const question = questionFor(
      after([point(1, 0), point(8, 8), point(0, 1), point(8, 7)]),
    );
    expect(descriptionOf(question, "A9")).toBe(
      "Black stone at A9, on line 1. Captures nothing. The group it joins would have 3 liberties. Touches 2 own stones and 0 enemy stones",
    );
    const cornered = questionFor(
      after([point(8, 8), point(0, 1), point(8, 7), point(1, 1)]),
    );
    expect(descriptionOf(cornered, "A9")).toContain(
      "would have 1 liberty: in atari",
    );
  });

  it("describes the pass with the score the board would settle at", () => {
    const fresh = questionFor(after([]));
    expect(descriptionOf(fresh, "pass")).toBe(
      "Pass: plays no stone. If the opponent passes next, the game ends and is scored as it stands: Black 0 to White 7.5 with komi counted: White leads by 7.5",
    );
    const answered = questionFor(after([point(3, 5), "pass"]));
    expect(descriptionOf(answered, "pass")).toContain(
      "The opponent has just passed, so this ends the game",
    );
    expect(descriptionOf(answered, "pass")).toContain(
      "Black 81 to White 7.5 with komi counted: Black leads by 73.5",
    );
  });

  it("tells the mover its colour", () => {
    expect(questionFor(after([])).instructions).toContain(
      "You are Black and it is your move.",
    );
    const white = after([point(3, 5)]);
    expect(
      goJevQuestion(white, goGame.legalMoves(white, WHITE)).instructions,
    ).toContain("You are White and it is your move.");
  });

  it("offers every move on a 9x9 board, under the gateway's option limit", () => {
    expect(OPENING_MOVES).toBeLessThan(JEV_MAX_OPTIONS);
    expect(questionFor(after([])).options).toHaveLength(OPENING_MOVES);
    expect(questionFor(after([])).instructions).not.toContain(
      "legal moves are offered",
    );
  });

  it("cuts a 19x19 opening to the option limit, keeping the pass and the original numbering", () => {
    const state = afterOnFullBoard([]);
    const moves = goGame.legalMoves(state, BLACK);
    expect(moves).toHaveLength(FULL_BOARD_OPENING_MOVES);
    const question = goJevQuestion(state, moves);
    expect(question.options).toHaveLength(JEV_MAX_OPTIONS);
    expect(question.options.map(option => option.move.label)).toContain("pass");
    question.options.map(option =>
      expect(option.key).toBe(
        jevOptionKey(moves.indexOf(option.move), option.move.label),
      ),
    );
    expect(question.instructions).toContain(
      `Only ${JEV_MAX_OPTIONS} of the ${FULL_BOARD_OPENING_MOVES} legal moves are offered`,
    );
    // Every first-line point is weaker by these facts than any inner point.
    expect(descriptionOf(question, "A1")).toBeUndefined();
    expect(descriptionOf(question, "T19")).toBeUndefined();
    expect(descriptionOf(question, "D4")).toContain("on line 4");
    expect(descriptionOf(question, "K10")).toContain("on line 10");
  });

  it("keeps a capture on the edge inside the cut list", () => {
    // White's A19 stone hangs by A18, a first-line point.
    const state = afterOnFullBoard([point(1, 0), point(0, 0)]);
    const moves = goGame.legalMoves(state, BLACK);
    const question = goJevQuestion(state, moves);
    expect(question.options).toHaveLength(JEV_MAX_OPTIONS);
    expect(descriptionOf(question, "A18")).toContain("Captures 1 White stone");
    expect(descriptionOf(question, "A1")).toBeUndefined();
  });

  it("refuses a placement the rules do not allow", () => {
    const state = after([point(3, 5)]);
    expect(() =>
      goJevQuestion(state, [{ kind: "place", x: 3, y: 5, label: "D4" }]),
    ).toThrow("D4 is occupied");
  });

  it("maps Jev's distribution back onto the legal moves", () => {
    const question = questionFor(after([]));
    const read = readJevChoice(
      {
        type: "choice",
        choice: "34. G6",
        probabilities: { "34. G6": 0.5, "82. pass": 0.45, "1. A9": 0.005 },
      },
      question.options,
    );
    expect(read.move).toEqual({ kind: "place", x: 6, y: 3, label: "G6" });
    expect(read.reasoning).toBe(
      "Jev picked this with 50% probability. Runner-up: pass (45%).",
    );
    expect(read.distribution).toEqual([
      { move: { kind: "place", x: 6, y: 3, label: "G6" }, weight: 0.5 },
      { move: { kind: "pass", label: "pass" }, weight: 0.45 },
    ]);
  });
});

describe("goJevState", () => {
  it("spells the board out row by row with the score as it stands", () => {
    const jevState = goJevState(after([point(3, 5), point(5, 3)]), "");
    expect(jevState.size).toBe(9);
    expect(jevState.sideToMove).toBe("Black");
    expect(jevState.moveNumber).toBe(3);
    expect(jevState.columns).toBe("   A B C D E F G H J");
    expect(jevState.board).toEqual([
      " 9 . . . . . . . . .",
      " 8 . . . . . . . . .",
      " 7 . . . . . . . . .",
      " 6 . . . . . W . . .",
      " 5 . . . . . . . . .",
      " 4 . . . B . . . . .",
      " 3 . . . . . . . . .",
      " 2 . . . . . . . . .",
      " 1 . . . . . . . . .",
    ]);
    expect(jevState.captures).toEqual({ black: 0, white: 0 });
    expect(jevState.komi).toBe(7.5);
    expect(jevState.consecutivePasses).toBe(0);
    expect(jevState.scoreIfGameEndedNow).toEqual({
      black: 1,
      white: 8.5,
      summary: "Black 1 to White 8.5 with komi counted: White leads by 7.5",
    });
    expect(jevState.recentMoves).toEqual(["D4", "F6"]);
    expect(jevState).not.toHaveProperty("strategyOverride");
  });

  it("omits the recent moves before the first one and carries the trimmed override", () => {
    const fresh = goJevState(after([]), "  Take the corners.  ");
    expect(fresh).not.toHaveProperty("recentMoves");
    expect(fresh.strategyOverride).toBe("Take the corners.");
  });

  it("counts captures and passes as the state records them", () => {
    const jevState = goJevState(
      after([point(0, 0), point(1, 0), point(8, 8), point(0, 1), "pass"]),
      "",
    );
    expect(jevState.captures).toEqual({ black: 0, white: 1 });
    expect(jevState.consecutivePasses).toBe(1);
    expect(jevState.sideToMove).toBe("White");
  });
});

describe("the Go definition", () => {
  it("judges with Jev through the shared evaluate step", () => {
    expect(goGame.evaluate).toBe(goEvaluate);
  });
});
