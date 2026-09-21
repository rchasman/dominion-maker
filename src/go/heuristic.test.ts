import { describe, expect, it } from "bun:test";
import { goHeuristic } from "./heuristic";
import { createGoGame, type GoEngine } from "./engine";
import type { GoCommand, GoMoveRecord, GoState } from "./shape";

const BLACK = "black";
const WHITE = "white";

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

const play = (engine: GoEngine, moves: GoMoveRecord[]) =>
  moves.map((move, index) => {
    const playerId = index % 2 === 0 ? BLACK : WHITE;
    const result = engine.dispatch(
      move === "pass"
        ? { type: "PASS", playerId }
        : { type: "PLACE", playerId, x: move.x, y: move.y },
    );
    if (!result.ok) throw new Error(result.error);
    return result;
  });

const after = (moves: GoMoveRecord[]): GoState => {
  const engine = createGoGame([BLACK, WHITE], { size: 9 });
  play(engine, moves);
  return engine.state;
};

const chosen = (state: GoState, player: string): GoMoveRecord | "resign" => {
  const command: GoCommand = goHeuristic(state, player);
  if (command.type === "PLACE") return { x: command.x, y: command.y };
  return command.type === "PASS" ? "pass" : "resign";
};

describe("the Go heuristic plays the obvious move", () => {
  it("captures the biggest group it can", () => {
    // Two white stones on E5-F5 hang by G5; a lone white stone on A9 hangs by A8.
    const state = after([
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
    ]);
    expect(chosen(state, BLACK)).toEqual(point(6, 4));
  });

  it("saves its own group in atari before it extends elsewhere", () => {
    // Black's E5-F5 pair hangs by G5; H2 touches two black stones and would
    // win on adjacency alone.
    const state = after([
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
    ]);
    expect(chosen(state, BLACK)).toEqual(point(6, 4));
  });

  it("extends from its stones without filling its own eye", () => {
    // A9 is Black's eye and comes first in board order; B8 touches the same
    // two stones and is not an eye.
    const state = after([point(1, 0), point(8, 8), point(0, 1), point(8, 7)]);
    expect(chosen(state, BLACK)).toEqual(point(1, 1));
  });

  it("gives the same opening move for the same board twice", () => {
    const first = chosen(after([]), BLACK);
    expect(chosen(after([]), BLACK)).toEqual(first);
    expect(chosen(after([]), BLACK)).toEqual(first);
    expect(first).not.toBe("pass");
  });

  it("does not answer every board with the same quiet move", () => {
    const replies = [point(4, 4), point(2, 2), point(6, 6), point(0, 8)].map(
      opening => JSON.stringify(chosen(after([opening]), WHITE)),
    );
    expect(new Set(replies).size).toBeGreaterThan(1);
  });

  it("passes when the opponent has passed and it is ahead", () => {
    expect(chosen(after([point(4, 4), "pass"]), BLACK)).toBe("pass");
  });

  it("plays on when the opponent has passed and it is behind", () => {
    // Every empty point is neutral, so komi puts White ahead on stones alone.
    const state = after([point(4, 4), point(2, 2), point(6, 6), "pass"]);
    expect(chosen(state, BLACK)).not.toBe("pass");
  });

  it("plays on when it is ahead but the opponent has not passed", () => {
    expect(chosen(after([point(4, 4), point(2, 2)]), BLACK)).not.toBe("pass");
  });

  it("refuses to move once the game is over", () => {
    const engine = createGoGame([BLACK, WHITE], { size: 9 });
    engine.dispatch({ type: "RESIGN", playerId: WHITE });
    expect(() => goHeuristic(engine.state, BLACK)).toThrow(
      "Go heuristic was asked for a move after the game ended",
    );
  });

  it("refuses to move for the side that is not to move", () => {
    expect(() => goHeuristic(after([]), WHITE)).toThrow("it is black to move");
  });
});
