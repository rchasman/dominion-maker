import { describe, it, expect } from "bun:test";
import { createGoGame, loadGoEngine } from "./engine";
import type { GoEngine } from "./engine";
import { KOMI } from "./rules";
import type { GoEvent, GoMoveRecord } from "./shape";
import { playGoMoves } from "./test-helpers";

const BLACK = "black";
const WHITE = "white";
const SIZE = 9;

const newGame = (): GoEngine => createGoGame([BLACK, WHITE], { size: SIZE });

const moverAt = (index: number) => (index % 2 === 0 ? BLACK : WHITE);

const play = (engine: GoEngine, moves: GoMoveRecord[]) =>
  playGoMoves(engine, [BLACK, WHITE], moves);

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

// Black surrounds White's stone on E5 and lifts it with the fourth stone.
const CAPTURE: GoMoveRecord[] = [
  point(3, 4),
  point(4, 4),
  point(5, 4),
  point(8, 8),
  point(4, 3),
  point(8, 7),
  point(4, 5),
];

type LogEntry = { playerId: string } & (
  | { x: number; y: number }
  | { pass: true }
  | { resigned: true }
);

const eventOf = (entry: LogEntry, id: string): GoEvent => {
  if ("resigned" in entry)
    return { type: "RESIGNED", playerId: entry.playerId, id };
  if ("pass" in entry) return { type: "PASSED", playerId: entry.playerId, id };
  return {
    type: "STONE_PLACED",
    playerId: entry.playerId,
    x: entry.x,
    y: entry.y,
    id,
  };
};

const logOf = (players: [string, string], entries: LogEntry[]): GoEvent[] => [
  { type: "GAME_INITIALIZED", players, size: SIZE, id: "log-0" },
  ...entries.map((entry, index) => eventOf(entry, `log-${index + 1}`)),
];

const TWO_PASSES: LogEntry[] = [
  { playerId: BLACK, pass: true },
  { playerId: WHITE, pass: true },
];

describe("the Go engine records moves as events", () => {
  it("starts from an empty board of the chosen size with Black to move", () => {
    const engine = newGame();
    expect(engine.state.size).toBe(SIZE);
    expect(engine.state.board).toBe(".".repeat(SIZE * SIZE));
    expect(engine.state.playerOrder).toEqual([BLACK, WHITE]);
    expect(engine.state.moves).toEqual([]);
    expect(engine.state.captures).toEqual([0, 0]);
    expect(engine.state.consecutivePasses).toBe(0);
    expect(engine.state.gameOver).toBe(false);
    expect(engine.state.result).toBeNull();
    expect(engine.state.winnerId).toBeNull();
    expect(engine.state.score).toBeNull();
    expect(createGoGame([BLACK, WHITE], { size: 19 }).state.board).toHaveLength(
      361,
    );
  });

  it("appends a STONE_PLACED and puts the stone on the board", () => {
    const engine = newGame();
    const result = engine.dispatch(
      { type: "PLACE", playerId: BLACK, x: 3, y: 5 },
      BLACK,
    );
    expect(result).toEqual({
      ok: true,
      events: [
        {
          type: "STONE_PLACED",
          playerId: BLACK,
          x: 3,
          y: 5,
          id: expect.any(String),
        },
      ],
    });
    expect(engine.state.board.charAt(5 * SIZE + 3)).toBe("B");
    expect(engine.state.moves).toEqual([{ x: 3, y: 5 }]);
  });

  it("appends a PASSED and counts it", () => {
    const engine = newGame();
    const result = engine.dispatch({ type: "PASS", playerId: BLACK }, BLACK);
    expect(result).toEqual({
      ok: true,
      events: [{ type: "PASSED", playerId: BLACK, id: expect.any(String) }],
    });
    expect(engine.state.moves).toEqual(["pass"]);
    expect(engine.state.consecutivePasses).toBe(1);
    expect(engine.state.gameOver).toBe(false);
  });

  it("rejects an occupied point, naming it", () => {
    const engine = newGame();
    play(engine, [point(3, 5)]);
    const result = engine.dispatch(
      { type: "PLACE", playerId: WHITE, x: 3, y: 5 },
      WHITE,
    );
    expect(result).toEqual({ ok: false, error: "D4 is occupied" });
    expect(engine.eventLog).toHaveLength(2);
  });

  it("rejects a point off the board", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "PLACE", playerId: BLACK, x: 9, y: 0 }, BLACK),
    ).toEqual({ ok: false, error: "That point is off the board" });
  });

  it("rejects a suicide", () => {
    const engine = newGame();
    play(engine, [point(8, 8), point(1, 0), point(8, 7), point(0, 1)]);
    expect(
      engine.dispatch({ type: "PLACE", playerId: BLACK, x: 0, y: 0 }, BLACK),
    ).toEqual({ ok: false, error: "A9 is suicide" });
  });

  it("rejects a move made out of turn", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "PLACE", playerId: WHITE, x: 4, y: 4 }, WHITE),
    ).toEqual({ ok: false, error: "Not your move" });
    expect(engine.dispatch({ type: "PASS", playerId: WHITE }, WHITE)).toEqual({
      ok: false,
      error: "Not your move",
    });
  });

  it("rejects a move whose actor is not the mover", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "PLACE", playerId: BLACK, x: 4, y: 4 }, WHITE),
    ).toEqual({ ok: false, error: "Not your move" });
  });

  it("accepts a dispatch that names no actor", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "PLACE", playerId: BLACK, x: 4, y: 4 }).ok,
    ).toBe(true);
  });

  it("rejects a resignation from someone who is not playing", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "RESIGN", playerId: "kibitzer" }, "kibitzer"),
    ).toEqual({ ok: false, error: "Not your game" });
  });

  it("lifts captured stones and credits the captor", () => {
    const engine = newGame();
    play(engine, CAPTURE);
    expect(engine.state.board.charAt(4 * SIZE + 4)).toBe(".");
    expect(engine.state.captures).toEqual([1, 0]);
  });
});

describe("the Go engine ends a game", () => {
  it("scores the board with komi after two passes", () => {
    const engine = newGame();
    play(engine, [point(4, 4), "pass", "pass"]);
    expect(engine.state.gameOver).toBe(true);
    expect(engine.state.consecutivePasses).toBe(2);
    expect(engine.state.result).toBe("score");
    expect(engine.state.score).toEqual({ black: 81, white: KOMI });
    expect(engine.state.winnerId).toBe(BLACK);
  });

  it("gives an empty board to White on komi alone", () => {
    const engine = newGame();
    play(engine, ["pass", "pass"]);
    expect(engine.state.result).toBe("score");
    expect(engine.state.score).toEqual({ black: 0, white: KOMI });
    expect(engine.state.winnerId).toBe(WHITE);
  });

  it("keeps playing when passes are not consecutive", () => {
    const engine = newGame();
    play(engine, ["pass", point(4, 4), "pass", point(2, 2)]);
    expect(engine.state.consecutivePasses).toBe(0);
    expect(engine.state.gameOver).toBe(false);
    expect(engine.state.score).toBeNull();
  });

  it("gives the game to the other player on a resignation", () => {
    const engine = newGame();
    const result = engine.dispatch({ type: "RESIGN", playerId: BLACK }, BLACK);
    expect(result.ok).toBe(true);
    expect(engine.state.gameOver).toBe(true);
    expect(engine.state.result).toBe("resignation");
    expect(engine.state.winnerId).toBe(WHITE);
    expect(engine.state.score).toBeNull();
  });

  it("decides a resigned game by the resignation, not by the board", () => {
    const engine = newGame();
    // Black holds the whole board and resigns anyway: White wins, unscored
    play(engine, [point(4, 4), "pass"]);
    engine.dispatch({ type: "RESIGN", playerId: BLACK }, BLACK);
    expect(engine.state.result).toBe("resignation");
    expect(engine.state.winnerId).toBe(WHITE);
    expect(engine.state.score).toBeNull();
  });

  it("rejects every command once the game is over", () => {
    const engine = newGame();
    play(engine, ["pass", "pass"]);
    const after = engine.eventLog.length;
    expect(
      engine.dispatch({ type: "PLACE", playerId: BLACK, x: 4, y: 4 }, BLACK),
    ).toEqual({ ok: false, error: "Game is over" });
    expect(engine.dispatch({ type: "PASS", playerId: BLACK }, BLACK)).toEqual({
      ok: false,
      error: "Game is over",
    });
    expect(engine.dispatch({ type: "RESIGN", playerId: WHITE }, WHITE)).toEqual(
      { ok: false, error: "Game is over" },
    );
    expect(engine.eventLog).toHaveLength(after);
  });
});

describe("the Go engine is restorable from its log", () => {
  it("gives the same state when the log is replayed", () => {
    const engine = newGame();
    play(engine, [...CAPTURE, "pass", "pass"]);
    expect(loadGoEngine(engine.eventLog).state).toEqual(engine.state);
  });

  it("numbers every event after the id of the first", () => {
    const engine = newGame();
    play(engine, [point(4, 4), "pass"]);
    const first = engine.eventLog[0]?.id ?? "";
    expect(first).not.toBe("");
    expect(engine.eventLog.map(event => event.id)).toEqual([
      first,
      `${first.slice(0, first.lastIndexOf("-"))}-1`,
      `${first.slice(0, first.lastIndexOf("-"))}-2`,
    ]);
  });

  it("keeps the ids it was loaded with and numbers new events after them", () => {
    const engine = newGame();
    play(engine, [point(4, 4)]);
    const loaded = loadGoEngine(engine.eventLog);
    expect(loaded.eventLog.map(e => e.id)).toEqual(
      engine.eventLog.map(e => e.id),
    );
    loaded.dispatch({ type: "PLACE", playerId: WHITE, x: 2, y: 2 }, WHITE);
    const prefix = (engine.eventLog[0]?.id ?? "").replace(/-\d+$/, "");
    expect(loaded.eventLog[2]?.id).toBe(`${prefix}-2`);
  });

  it("rewinds the log, the board and the move list on truncateTo", () => {
    const engine = newGame();
    play(engine, [point(4, 4)]);
    const afterOneMove = engine.state.board;
    engine.dispatch({ type: "PLACE", playerId: WHITE, x: 2, y: 2 }, WHITE);
    engine.dispatch({ type: "PLACE", playerId: BLACK, x: 6, y: 6 }, BLACK);
    engine.truncateTo(2);
    expect(engine.eventLog).toHaveLength(2);
    expect(engine.state.moves).toEqual([{ x: 4, y: 4 }]);
    expect(engine.state.board).toBe(afterOneMove);
  });

  it("tells subscribers about a truncation", () => {
    const engine = newGame();
    play(engine, [point(4, 4), point(2, 2)]);
    const seen: number[] = [];
    engine.subscribe(events => seen.push(events.length));
    engine.truncateTo(1);
    expect(seen).toEqual([1]);
  });

  it("refuses a log with no GAME_INITIALIZED event", () => {
    expect(() => loadGoEngine([])).toThrow();
  });
});

describe("the Go engine distrusts a log it did not build", () => {
  it("refuses a stone placed by the player who is not to move", () => {
    const log = logOf(
      [BLACK, WHITE],
      [
        { playerId: BLACK, x: 4, y: 4 },
        { playerId: BLACK, x: 2, y: 2 },
      ],
    );
    expect(() => loadGoEngine(log)).toThrow(/C7/);
  });

  it("refuses a pass by the player who is not to move", () => {
    const log = logOf([BLACK, WHITE], [{ playerId: WHITE, pass: true }]);
    expect(() => loadGoEngine(log)).toThrow(/a pass/);
  });

  it("refuses a stone attributed to someone who is not playing", () => {
    const log = logOf([BLACK, WHITE], [{ playerId: "kibitzer", x: 4, y: 4 }]);
    expect(() => loadGoEngine(log)).toThrow(/kibitzer/);
  });

  it("refuses a RESIGNED from someone who is not playing", () => {
    const log = logOf(
      [BLACK, WHITE],
      [{ playerId: "kibitzer", resigned: true }],
    );
    expect(() => loadGoEngine(log)).toThrow(/kibitzer/);
  });

  it("refuses a stone placed after two passes ended the game", () => {
    const log = logOf(
      [BLACK, WHITE],
      [...TWO_PASSES, { playerId: BLACK, x: 4, y: 4 }],
    );
    expect(() => loadGoEngine(log)).toThrow(
      /black playing E5 after two passes ended the game/,
    );
  });

  it("refuses a pass after two passes ended the game", () => {
    const log = logOf(
      [BLACK, WHITE],
      [...TWO_PASSES, { playerId: BLACK, pass: true }],
    );
    expect(() => loadGoEngine(log)).toThrow(/after two passes ended the game/);
  });

  it("refuses a stone placed after a resignation", () => {
    const log = logOf(
      [BLACK, WHITE],
      [
        { playerId: BLACK, resigned: true },
        { playerId: BLACK, x: 4, y: 4 },
      ],
    );
    expect(() => loadGoEngine(log)).toThrow(
      /black playing E5 after black resigned/,
    );
  });

  it("refuses a pass after a resignation, so no score can override it", () => {
    const log = logOf(
      [BLACK, WHITE],
      [
        { playerId: WHITE, resigned: true },
        { playerId: BLACK, pass: true },
        { playerId: WHITE, pass: true },
      ],
    );
    expect(() => loadGoEngine(log)).toThrow(/after white resigned/);
  });

  it("refuses a resignation after two passes ended the game", () => {
    const log = logOf(
      [BLACK, WHITE],
      [...TWO_PASSES, { playerId: BLACK, resigned: true }],
    );
    expect(() => loadGoEngine(log)).toThrow(
      /black resigning after two passes ended the game/,
    );
  });

  it("refuses a stone the rules would not have allowed", () => {
    const log = logOf(
      [BLACK, WHITE],
      [
        { playerId: BLACK, x: 4, y: 4 },
        { playerId: WHITE, x: 4, y: 4 },
      ],
    );
    expect(() => loadGoEngine(log)).toThrow(/Move 2, White at E5, is occupied/);
  });

  it("accepts a hand-built log whose movers are right", () => {
    const finished: GoMoveRecord[] = [...CAPTURE, "pass", "pass"];
    const entries = finished.map(
      (move, index): LogEntry =>
        move === "pass"
          ? { playerId: moverAt(index), pass: true }
          : { playerId: moverAt(index), x: move.x, y: move.y },
    );
    const engine = loadGoEngine(logOf([BLACK, WHITE], entries));
    expect(engine.state.result).toBe("score");
    expect(engine.state.gameOver).toBe(true);
    expect(engine.state.captures).toEqual([1, 0]);
    // Black holds five points, the lifted one included; White's two stones
    // and komi outscore them, and the open middle is nobody's.
    expect(engine.state.score).toEqual({ black: 5, white: 2 + KOMI });
    expect(engine.state.winnerId).toBe(WHITE);
  });
});
