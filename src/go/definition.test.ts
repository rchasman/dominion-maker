import { describe, expect, it } from "bun:test";
import { goGame } from "./definition";
import { createGoGame, type GoEngine } from "./engine";
import { replyFormatInstruction } from "../core/consensus/numbered-choice";
import { KOMI } from "./rules";
import type { GoMove, GoMoveRecord, GoState } from "./shape";
import { playGoMoves } from "./test-helpers";

const BLACK = "black";
const WHITE = "white";
const OPENING_MOVES = 82;

const play = (engine: GoEngine, moves: GoMoveRecord[]) =>
  playGoMoves(engine, [BLACK, WHITE], moves);

const newGame = () => createGoGame([BLACK, WHITE], { size: 9 });

const promptFor = (state: GoState, customStrategy = "") =>
  goGame.prompt({
    state,
    player: goGame.whoMustAct(state) ?? BLACK,
    moves: goGame.legalMoves(state, BLACK),
    playerStrategies: {},
    customStrategy,
  });

const labelled = (moves: GoMove[], label: string): GoMove | undefined =>
  moves.find(move => move.label === label);

describe("the Go definition answers what the driver asks", () => {
  it("offers every point of the empty board and the pass, each labelled", () => {
    const moves = goGame.legalMoves(newGame().state, BLACK);
    expect(moves).toHaveLength(OPENING_MOVES);
    expect(moves[0]).toEqual({ kind: "place", x: 0, y: 0, label: "A9" });
    expect(moves[80]).toEqual({ kind: "place", x: 8, y: 8, label: "J1" });
    expect(moves[81]).toEqual({ kind: "pass", label: "pass" });
    expect(labelled(moves, "D4")).toEqual({
      kind: "place",
      x: 3,
      y: 5,
      label: "D4",
    });
  });

  it("drops a taken point and a superko repeat from the table", () => {
    const engine = newGame();
    play(engine, [{ x: 4, y: 4 }]);
    const moves = goGame.legalMoves(engine.state, WHITE);
    expect(moves).toHaveLength(OPENING_MOVES - 1);
    expect(labelled(moves, "E5")).toBeUndefined();
  });

  it("hands the turn over and stops once the game is over", () => {
    const engine = newGame();
    expect(goGame.players(engine.state)).toEqual([BLACK, WHITE]);
    expect(goGame.whoMustAct(engine.state)).toBe(BLACK);
    play(engine, [{ x: 4, y: 4 }]);
    expect(goGame.whoMustAct(engine.state)).toBe(WHITE);
    engine.dispatch({ type: "RESIGN", playerId: WHITE });
    expect(goGame.whoMustAct(engine.state)).toBeNull();
    expect(goGame.legalMoves(engine.state, BLACK)).toEqual([]);
  });

  it("turns a picked stone or pass into the command the engine takes", () => {
    const engine = newGame();
    const moves = goGame.legalMoves(engine.state, BLACK);
    const stone = labelled(moves, "D4");
    expect(stone && goGame.moveToCommand(engine.state, stone, BLACK)).toEqual({
      type: "PLACE",
      playerId: BLACK,
      x: 3,
      y: 5,
    });
    const pass = labelled(moves, "pass");
    expect(pass && goGame.moveToCommand(engine.state, pass, BLACK)).toEqual({
      type: "PASS",
      playerId: BLACK,
    });
  });

  it("carries a model's reasoning on a move", () => {
    const picked: GoMove = { kind: "place", x: 3, y: 5, label: "D4" };
    const move = goGame.withReasoning(picked, "corner");
    expect(goGame.reasoningOf(move)).toBe("corner");
    expect(goGame.moveKey(move)).toBe("D4");
    expect(goGame.describeMove(move)).toBe("D4");
    expect(goGame.promptRow(move)).toEqual({ point: "D4" });
  });

  it("teaches the reply format in the system text", () => {
    const { system } = promptFor(newGame().state);
    expect(system.length).toBeGreaterThan(200);
    expect(system).toContain("Go");
    expect(system).toContain(replyFormatInstruction(OPENING_MOVES));
    expect(system).toContain('{"reasoning"');
  });

  it("shows the board, the captures, the komi and a numbered move table", () => {
    const engine = newGame();
    play(engine, [
      { x: 3, y: 5 },
      { x: 5, y: 3 },
    ]);
    const { user } = promptFor(engine.state);
    expect(user).toContain("   A B C D E F G H J");
    expect(user).toContain(" 9 . . . . . . . . .");
    expect(user).toContain(" 6 . . . . . O . . .");
    expect(user).toContain(" 4 . . . X . . . . .");
    expect(user).toContain(" 1 . . . . . . . . .");
    expect(user).toContain(`KOMI: ${KOMI} to White`);
    expect(user).toContain("Black has taken 0, White has taken 0");
    expect(user).toContain("LEGAL MOVES");
    expect(user).toContain("1\tA9");
    expect(user).toContain(`${OPENING_MOVES - 2}\tpass`);
  });

  it("recalls only the last eight moves", () => {
    const engine = newGame();
    play(engine, [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
      { x: 7, y: 0 },
      "pass",
      { x: 8, y: 0 },
    ]);
    const { user } = promptFor(engine.state);
    expect(user).toContain("RECENT MOVES: C9 D9 E9 F9 G9 H9 pass J9");
    expect(user).not.toContain("A9 B9");
  });

  it("adds a custom strategy only when there is one", () => {
    const state = newGame().state;
    expect(promptFor(state).user).not.toContain("STRATEGY");
    expect(promptFor(state, "  Take the corners.  ").user).toContain(
      "Take the corners.",
    );
  });

  it("describes the position for the consensus viewer", () => {
    const engine = newGame();
    play(engine, [{ x: 3, y: 5 }, "pass", { x: 5, y: 3 }]);
    const legal = goGame.legalMoves(engine.state, WHITE);
    const context = goGame.logContext(engine.state, WHITE, legal);
    expect(context.turnId).toBe(`${WHITE}-3`);
    expect(context.isChoice).toBe(false);
    expect(context.payload).toEqual({
      turn: 4,
      phase: "move",
      activePlayerId: WHITE,
      size: 9,
      board: engine.state.board,
      captures: [0, 0],
      moves: ["D4", "pass", "F6"],
      lastMove: "F6",
    });
  });

  it("names the turn and the phase the consensus action id is built from", () => {
    // `t${turn}-${phase}-...` reads "tundefined-undefined" without these two.
    const engine = newGame();
    const { payload } = goGame.logContext(
      engine.state,
      BLACK,
      goGame.legalMoves(engine.state, BLACK),
    );
    expect(typeof payload["turn"]).toBe("number");
    expect(payload["turn"]).toBe(1);
    expect(payload["phase"]).toBe("move");
    expect(payload["lastMove"]).toBeNull();
  });
});
