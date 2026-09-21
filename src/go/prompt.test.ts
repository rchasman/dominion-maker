import { describe, expect, it } from "bun:test";
import { replyFormatInstruction } from "../core/consensus/numbered-choice";
import { goGame } from "./definition";
import { KOMI } from "./rules";
import type { GoMove, GoMoveRecord, GoState } from "./shape";
import { factsOf } from "./candidates";
import { goStateAfter, goStateFromRows } from "./test-helpers";

const BLACK = "black";
const WHITE = "white";
const OPENING_MOVES = 81;
const PASS: GoMove = { kind: "pass", label: "pass" };
const FACT_HEADER =
  "{choice\tpoint\tline\tcaptures\tlibertiesAfter\trescues\tatari\ttouchesOwn\ttouchesEnemy}:";

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

const after = (moves: GoMoveRecord[]): GoState =>
  goStateAfter([BLACK, WHITE], moves);

const promptFor = (state: GoState, customStrategy = "", moves?: GoMove[]) => {
  const player = goGame.whoMustAct(state) ?? BLACK;
  return goGame.prompt({
    state,
    player,
    moves: moves ?? goGame.legalMoves(state, player),
    playerStrategies: {},
    customStrategy,
  });
};

describe("the Go prompt", () => {
  it("teaches the reply format and the fact columns in the system text", () => {
    const { system } = promptFor(after([]));
    expect(system).toContain("Go");
    expect(system).toContain(replyFormatInstruction(OPENING_MOVES));
    expect(system).toContain('{"reasoning"');
    expect(system).toContain("libertiesAfter");
    expect(system).toContain("captures and rescues come first");
    expect(system).toContain("1 with captures 0 is self-atari");
    expect(system).toContain("1 after a capture is a ko or snapback");
    expect(system).toContain("fill the neutral points before you pass");
    expect(system).toContain(
      "The pass is in the table only when every remaining stone is self-atari or fills your own eye",
    );
    expect(system).not.toContain("Open in the corners");
  });

  it("shows the board, the captures, the komi and the fact table", () => {
    const { user } = promptFor(after([point(3, 5), point(5, 3)]));
    expect(user).toContain("   A B C D E F G H J");
    expect(user).toContain(" 9 . . . . . . . . .");
    expect(user).toContain(" 6 . . . . . O . . .");
    expect(user).toContain(" 4 . . . X . . . . .");
    expect(user).toContain(" 1 . . . . . . . . .");
    expect(user).toContain(`KOMI: ${KOMI} to White`);
    expect(user).toContain("Black has taken 0, White has taken 0");
    expect(user).toContain("LEGAL MOVES");
    expect(user).toContain(`[${OPENING_MOVES - 2}\t]${FACT_HEADER}`);
    expect(user).toContain("\n  1\tA9\t1\t0\t2\t0\t0\t0\t0\n");
    expect(user).not.toContain("pass");
  });

  it("states the score, the territory and every group before the table", () => {
    const { user } = promptFor(after([point(3, 5), point(5, 3)]));
    expect(user).toContain(
      "POSITION: if the game ended now, Black 1 to White 8.5 with komi counted: White leads by 7.5.",
    );
    expect(user).toContain(
      "EMPTY POINTS: 0 Black territory, 0 White territory, 79 neutral",
    );
    expect(user).toContain("BLACK GROUPS: 1 stone around D4, 4 liberties");
    expect(user).toContain("WHITE GROUPS: 1 stone around F6, 4 liberties");
    expect(user.indexOf("POSITION:")).toBeLessThan(user.indexOf("LEGAL MOVES"));
  });

  it("flags a group in atari on either side", () => {
    // Black's E5-F5 pair hangs by G5
    const { user } = promptFor(
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
    expect(user).toContain(
      "BLACK GROUPS: 2 stones around E5, 1 liberty (IN ATARI); 1 stone around J3, 3 liberties; 2 stones around H2, 5 liberties",
    );
    expect(user).toContain(
      "WHITE GROUPS: 2 stones around E6, 4 liberties; 1 stone around D5, 3 liberties; 2 stones around E4, 4 liberties",
    );
    expect(user).toMatch(/\n +\d+\tG5\t3\t0\t3\t2\t0\t1\t0\n/);
  });

  it("puts the capture and the atari counts in the row", () => {
    // White's E5 stone has Black on D5 and F5; E6 leaves it one liberty
    const { user } = promptFor(
      after([point(3, 4), point(4, 4), point(5, 4), point(7, 8)]),
    );
    expect(user).toMatch(/\n +\d+\tE6\t4\t0\t3\t0\t1\t0\t1\n/);
    expect(user).toContain(
      "WHITE GROUPS: 1 stone around E5, 2 liberties; 1 stone around H1",
    );
  });

  it("gives the pass row its effect and no stone facts", () => {
    const { user } = promptFor(after([point(3, 5), "pass"]));
    expect(user).toContain(
      `${OPENING_MOVES}\t"pass: ends the game now, scored as it stands: Black 81 to White 7.5 with komi counted: Black leads by 73.5"\tn/a\tn/a\tn/a\tn/a\tn/a\tn/a\tn/a`,
    );
    const asked = promptFor(after([]), "", [PASS]);
    expect(asked.user).toContain(
      "pass: ends the game if the opponent passes too; score would be Black 0 to White 7.5 with komi counted: White leads by 7.5",
    );
    expect(asked.system).toContain(replyFormatInstruction(1));
  });

  it("offers the pass once every remaining stone is self-atari, as the guidance says", () => {
    // Black lives with two eyes at B8 and D8; its F5 stone breathes at E5 and
    // G5 inside White's sea, so every offered Black stone leaves one liberty
    const state = goStateFromRows(
      [BLACK, WHITE],
      [
        "B B B B W W W W W",
        "B . B . B W W W W",
        "B B B B B W W W W",
        "W W W W W W W W W",
        "W W W W . B . W W",
        "W W W W W W W W W",
        "W W W W W W W W W",
        "W W W W W W W W W",
        "W W W W W W W W W",
      ],
    );
    const moves = goGame.legalMoves(state, BLACK);
    const placements = factsOf(state, moves).flatMap(({ facts }) =>
      facts === null ? [] : [facts],
    );
    expect(placements.length).toBeGreaterThan(0);
    placements.map(facts => expect(facts.libertiesAfter).toBe(1));
    const { system, user } = promptFor(state);
    expect(user).toContain("pass: ends the game if the opponent passes too");
    expect(system).toContain(
      "only when every remaining stone is self-atari or fills your own eye",
    );
  });

  it("recalls only the last eight moves", () => {
    const { user } = promptFor(
      after([
        point(0, 0),
        point(1, 0),
        point(2, 0),
        point(3, 0),
        point(4, 0),
        point(5, 0),
        point(6, 0),
        point(7, 0),
        "pass",
        point(8, 0),
      ]),
    );
    expect(user).toContain("RECENT MOVES: C9 D9 E9 F9 G9 H9 pass J9");
    expect(user).not.toContain("A9 B9");
  });

  it("adds a custom strategy only when there is one", () => {
    const state = after([]);
    expect(promptFor(state).user).not.toContain("STRATEGY");
    expect(promptFor(state, "  Take the corners.  ").user).toContain(
      "Take the corners.",
    );
  });
});
