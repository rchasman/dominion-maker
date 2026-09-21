import { describe, expect, it } from "bun:test";
import { llmController, type DecideMove } from "../core/llm-controller";
import { offeredMoves } from "./candidates";
import { goGame } from "./definition";
import { createGoGame, type GoEngine } from "./engine";
import type { GoMove, GoMoveRecord, GoShape, GoState } from "./shape";
import { goStateAfter, playGoMoves } from "./test-helpers";

const BLACK = "black";
const WHITE = "white";
const OPENING_MOVES = 81;
const PASS: GoMove = { kind: "pass", label: "pass" };

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

const play = (engine: GoEngine, moves: GoMoveRecord[]) =>
  playGoMoves(engine, [BLACK, WHITE], moves);

const newGame = () => createGoGame([BLACK, WHITE], { size: 9 });

const after = (moves: GoMoveRecord[]): GoState =>
  goStateAfter([BLACK, WHITE], moves);

const labelled = (moves: GoMove[], label: string): GoMove | undefined =>
  moves.find(move => move.label === label);

const autoMoveAfter = (moves: GoMoveRecord[]): GoMove | undefined => {
  const state = after(moves);
  const player = goGame.whoMustAct(state) ?? BLACK;
  return goGame.autoMove?.(state, player, goGame.legalMoves(state, player));
};

/** A voter that must never be asked; the controller has to settle the move itself */
const neverAsked: DecideMove<GoShape> = () =>
  Promise.reject(new Error("the models were asked"));

describe("the Go definition answers what the driver asks", () => {
  it("offers every point of the empty board, each labelled, and no pass", () => {
    const moves = goGame.legalMoves(newGame().state, BLACK);
    expect(moves).toHaveLength(OPENING_MOVES);
    expect(moves[0]).toEqual({ kind: "place", x: 0, y: 0, label: "A9" });
    expect(moves[80]).toEqual({ kind: "place", x: 8, y: 8, label: "J1" });
    expect(labelled(moves, "pass")).toBeUndefined();
    expect(labelled(moves, "D4")).toEqual({
      kind: "place",
      x: 3,
      y: 5,
      label: "D4",
    });
  });

  it("drops a taken point from the table", () => {
    const engine = newGame();
    play(engine, [{ x: 4, y: 4 }]);
    const moves = goGame.legalMoves(engine.state, WHITE);
    expect(moves).toHaveLength(OPENING_MOVES - 1);
    expect(labelled(moves, "E5")).toBeUndefined();
  });

  it("offers the voters the moves the rules can defend", () => {
    // A9 is Black's eye here; the voters are not offered it, the engine still takes it
    const state = after([point(1, 0), point(7, 8), point(0, 1), point(7, 7)]);
    expect(goGame.legalMoves(state, BLACK)).toEqual(offeredMoves(state));
    expect(labelled(goGame.legalMoves(state, BLACK), "A9")).toBeUndefined();
    const engine = newGame();
    play(engine, [point(1, 0), point(7, 8), point(0, 1), point(7, 7)]);
    expect(
      engine.dispatch({ type: "PLACE", playerId: BLACK, x: 0, y: 0 }).ok,
    ).toBe(true);
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
    expect(goGame.moveToCommand(engine.state, PASS, BLACK)).toEqual({
      type: "PASS",
      playerId: BLACK,
    });
  });

  it("carries a model's reasoning on a move", () => {
    const picked: GoMove = { kind: "place", x: 3, y: 5, label: "D4" };
    const move = goGame.withReasoning(picked, "corner");
    expect(goGame.reasoningOf(move)).toBe("corner");
    expect(goGame.moveKey(move)).toBe("D4");
    expect(goGame.describeMove(newGame().state, move)).toBe("D4");
  });

  it("passes without a vote when the opponent has passed and it leads", async () => {
    expect(autoMoveAfter([point(3, 5), "pass"])).toEqual(PASS);
    const engine = newGame();
    play(engine, [point(3, 5), "pass"]);
    const controller = llmController(
      goGame,
      { kind: "llm", models: [], consensusCount: 1, customStrategy: "" },
      { decideMove: neverAsked, getPlayerStrategies: () => ({}) },
    );
    expect(
      await controller.decide(engine, BLACK, new AbortController().signal),
    ).toEqual({ type: "PASS", playerId: BLACK });
  });

  it("asks for a vote when it is behind, or when the opponent has not passed", () => {
    // Two Black stones against one White stone and komi: Black is behind
    expect(
      autoMoveAfter([point(4, 4), point(2, 6), point(6, 2), "pass"]),
    ).toBeUndefined();
    expect(autoMoveAfter([point(3, 5), point(2, 6)])).toBeUndefined();
    expect(autoMoveAfter([])).toBeUndefined();
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
