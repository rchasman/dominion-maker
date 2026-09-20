import { describe, it, expect } from "bun:test";
import { Chess } from "chess.js";
import { createChessGame, loadChessEngine } from "./engine";
import type { ChessEngine } from "./engine";

const WHITE = "white";
const BLACK = "black";
const START_FEN = new Chess().fen();

const newGame = (): ChessEngine => createChessGame([WHITE, BLACK]);

const play = (engine: ChessEngine, sans: string[]) =>
  sans.map((san, index) =>
    engine.dispatch(
      { type: "MOVE", playerId: index % 2 === 0 ? WHITE : BLACK, san },
      index % 2 === 0 ? WHITE : BLACK,
    ),
  );

const FOOLS_MATE = ["f3", "e5", "g4", "Qh4#"];
// The start position recurs for the third time on the eighth ply.
const THREEFOLD = ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"];

describe("the chess engine records moves as events", () => {
  it("starts from the initial position with white to move", () => {
    const engine = newGame();
    expect(engine.state.fen).toBe(START_FEN);
    expect(engine.state.playerOrder).toEqual([WHITE, BLACK]);
    expect(engine.state.moves).toEqual([]);
    expect(engine.state.gameOver).toBe(false);
    expect(engine.state.result).toBeNull();
    expect(engine.state.winnerId).toBeNull();
    expect(engine.state.inCheck).toBe(false);
  });

  it("appends a MOVE and advances the FEN on a legal SAN", () => {
    const engine = newGame();
    const result = engine.dispatch(
      { type: "MOVE", playerId: WHITE, san: "e4" },
      WHITE,
    );
    expect(result).toEqual({
      ok: true,
      events: [
        { type: "MOVE", playerId: WHITE, san: "e4", id: expect.any(String) },
      ],
    });
    expect(engine.state.fen).not.toBe(START_FEN);
    expect(engine.state.moves).toEqual(["e4"]);
  });

  it("normalises the SAN chess.js returns", () => {
    const engine = newGame();
    engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e2e4" }, WHITE);
    expect(engine.state.moves).toEqual(["e4"]);
  });

  it("rejects an illegal SAN with the message from chess.js", () => {
    const engine = newGame();
    const result = engine.dispatch(
      { type: "MOVE", playerId: WHITE, san: "e9" },
      WHITE,
    );
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain("e9");
    expect(engine.eventLog).toHaveLength(1);
  });

  it("rejects a move made out of turn", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "MOVE", playerId: BLACK, san: "e5" }, BLACK),
    ).toEqual({ ok: false, error: "Not your move" });
  });

  it("rejects a move whose actor is not the mover", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e4" }, BLACK),
    ).toEqual({ ok: false, error: "Not your move" });
  });

  it("accepts a dispatch that names no actor", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e4" }).ok,
    ).toBe(true);
  });

  it("rejects a resignation from someone who is not playing", () => {
    const engine = newGame();
    expect(
      engine.dispatch({ type: "RESIGN", playerId: "kibitzer" }, "kibitzer"),
    ).toEqual({ ok: false, error: "Not your game" });
  });
});

describe("the chess engine ends a game", () => {
  it("names the mating player the winner on checkmate", () => {
    const engine = newGame();
    play(engine, FOOLS_MATE);
    expect(engine.state.gameOver).toBe(true);
    expect(engine.state.result).toBe("checkmate");
    expect(engine.state.winnerId).toBe(BLACK);
    expect(engine.state.inCheck).toBe(true);
  });

  it("calls a threefold repetition a draw with no winner", () => {
    const engine = newGame();
    play(engine, THREEFOLD);
    expect(engine.state.gameOver).toBe(true);
    expect(engine.state.result).toBe("draw");
    expect(engine.state.winnerId).toBeNull();
  });

  it("gives the game to the other player on a resignation", () => {
    const engine = newGame();
    const result = engine.dispatch({ type: "RESIGN", playerId: WHITE }, WHITE);
    expect(result.ok).toBe(true);
    expect(engine.state.gameOver).toBe(true);
    expect(engine.state.result).toBe("resignation");
    expect(engine.state.winnerId).toBe(BLACK);
  });

  it("rejects every command once the game is over", () => {
    const engine = newGame();
    play(engine, FOOLS_MATE);
    const after = engine.eventLog.length;
    expect(
      engine.dispatch({ type: "MOVE", playerId: WHITE, san: "e4" }, WHITE),
    ).toEqual({ ok: false, error: "Game is over" });
    expect(engine.dispatch({ type: "RESIGN", playerId: BLACK }, BLACK)).toEqual(
      { ok: false, error: "Game is over" },
    );
    expect(engine.eventLog).toHaveLength(after);
  });
});

describe("the chess engine is restorable from its log", () => {
  it("gives the same state when the log is replayed", () => {
    const engine = newGame();
    play(engine, FOOLS_MATE);
    expect(loadChessEngine(engine.eventLog).state).toEqual(engine.state);
  });

  it("numbers every event after the id of the first", () => {
    const engine = newGame();
    play(engine, ["e4", "e5"]);
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
    play(engine, ["e4"]);
    const loaded = loadChessEngine(engine.eventLog);
    expect(loaded.eventLog.map(e => e.id)).toEqual(
      engine.eventLog.map(e => e.id),
    );
    loaded.dispatch({ type: "MOVE", playerId: BLACK, san: "e5" }, BLACK);
    const prefix = (engine.eventLog[0]?.id ?? "").replace(/-\d+$/, "");
    expect(loaded.eventLog[2]?.id).toBe(`${prefix}-2`);
  });

  it("rewinds the log, the FEN and the move list on truncateTo", () => {
    const engine = newGame();
    play(engine, ["e4"]);
    const afterOneMove = engine.state.fen;
    engine.dispatch({ type: "MOVE", playerId: BLACK, san: "e5" }, BLACK);
    engine.dispatch({ type: "MOVE", playerId: WHITE, san: "Nf3" }, WHITE);
    engine.truncateTo(2);
    expect(engine.eventLog).toHaveLength(2);
    expect(engine.state.moves).toEqual(["e4"]);
    expect(engine.state.fen).toBe(afterOneMove);
  });

  it("tells subscribers about a truncation", () => {
    const engine = newGame();
    play(engine, ["e4", "e5"]);
    const seen: number[] = [];
    engine.subscribe(events => seen.push(events.length));
    engine.truncateTo(1);
    expect(seen).toEqual([1]);
  });

  it("refuses a log with no GAME_INITIALIZED event", () => {
    expect(() => loadChessEngine([])).toThrow();
  });
});
