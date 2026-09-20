import { describe, expect, it } from "bun:test";
import { chessGame } from "./definition";
import { createChessGame, type ChessEngine } from "./engine";
import { replyFormatInstruction } from "../core/consensus/numbered-choice";
import type { ChessMove, ChessState } from "./shape";

const WHITE = "white";
const BLACK = "black";

const play = (engine: ChessEngine, sans: string[]) =>
  sans.map((san, index) =>
    engine.dispatch({
      type: "MOVE",
      playerId: index % 2 === 0 ? WHITE : BLACK,
      san,
    }),
  );

const promptFor = (state: ChessState, customStrategy = "") =>
  chessGame.prompt({
    state,
    player: chessGame.whoMustAct(state) ?? WHITE,
    moves: chessGame.legalMoves(state, WHITE),
    playerStrategies: {},
    customStrategy,
  });

const sanOf = (moves: ChessMove[], san: string): ChessMove | undefined =>
  moves.find(move => move.san === san);

describe("the chess definition answers what the driver asks", () => {
  it("offers the twenty opening moves, each with its squares", () => {
    const moves = chessGame.legalMoves(
      createChessGame([WHITE, BLACK]).state,
      WHITE,
    );
    expect(moves).toHaveLength(20);
    expect(
      moves.every(
        move => /^[a-h][1-8]$/.test(move.from) && /^[a-h][1-8]$/.test(move.to),
      ),
    ).toBe(true);
    expect(moves).toContainEqual({ san: "e4", from: "e2", to: "e4" });
  });

  it("hands the turn over and stops once the game is over", () => {
    const engine = createChessGame([WHITE, BLACK]);
    expect(chessGame.players(engine.state)).toEqual([WHITE, BLACK]);
    expect(chessGame.whoMustAct(engine.state)).toBe(WHITE);
    play(engine, ["e4"]);
    expect(chessGame.whoMustAct(engine.state)).toBe(BLACK);
    engine.dispatch({ type: "RESIGN", playerId: BLACK });
    expect(chessGame.whoMustAct(engine.state)).toBeNull();
    expect(chessGame.legalMoves(engine.state, WHITE)).toEqual([]);
  });

  it("turns a picked move into the command the engine takes", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const move = sanOf(chessGame.legalMoves(engine.state, WHITE), "e4");
    expect(move).toEqual({ san: "e4", from: "e2", to: "e4" });
    expect(move && chessGame.moveToCommand(engine.state, move, WHITE)).toEqual({
      type: "MOVE",
      playerId: WHITE,
      san: "e4",
    });
  });

  it("carries a model's reasoning on a move", () => {
    const picked: ChessMove = { san: "e4", from: "e2", to: "e4" };
    const move = chessGame.withReasoning(picked, "centre");
    expect(chessGame.reasoningOf(move)).toBe("centre");
    expect(chessGame.moveKey(move)).toBe("e4");
    expect(chessGame.describeMove(move)).toBe("e4");
    expect(chessGame.promptRow(move)).toEqual({ san: "e4" });
  });

  it("teaches the reply format in the system text", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const { system } = promptFor(engine.state);
    expect(system.length).toBeGreaterThan(200);
    expect(system).toContain("chess");
    expect(system).toContain(replyFormatInstruction(20));
    expect(system).toContain('{"reasoning"');
  });

  it("shows the board, the FEN and a numbered move table", () => {
    const engine = createChessGame([WHITE, BLACK]);
    const { user } = promptFor(engine.state);
    expect(user).toContain(engine.state.fen);
    expect(user).toContain("+------------------------+");
    expect(user).toContain("8 | r  n  b  q  k  b  n  r |");
    expect(user).toContain("LEGAL MOVES");
    expect(user).toContain("1\ta3");
  });

  it("recalls only the last eight moves", () => {
    const engine = createChessGame([WHITE, BLACK]);
    play(engine, ["a3", "a6", "b3", "b6", "c3", "c6", "d3", "d6", "e3", "e6"]);
    const { user } = promptFor(engine.state);
    expect(user).toContain("b3 b6 c3 c6 d3 d6 e3 e6");
    expect(user).not.toContain("a3 a6");
  });

  it("adds a custom strategy only when there is one", () => {
    const engine = createChessGame([WHITE, BLACK]);
    expect(promptFor(engine.state).user).not.toContain("STRATEGY");
    expect(promptFor(engine.state, "  Play the London.  ").user).toContain(
      "Play the London.",
    );
  });

  it("describes the position for the consensus viewer", () => {
    const engine = createChessGame([WHITE, BLACK]);
    play(engine, ["e4", "e5", "Nf3"]);
    const legal = chessGame.legalMoves(engine.state, BLACK);
    const context = chessGame.logContext(engine.state, BLACK, legal);
    expect(context.turnId).toBe(`${BLACK}-3`);
    expect(context.isChoice).toBe(false);
    expect(context.payload).toEqual({
      turn: 2,
      phase: "move",
      activePlayerId: BLACK,
      fen: engine.state.fen,
      moves: ["e4", "e5", "Nf3"],
      lastMove: "Nf3",
    });
  });

  it("names the turn and the phase the consensus action id is built from", () => {
    // `t${turn}-${phase}-...` reads "tundefined-undefined" without these two.
    const engine = createChessGame([WHITE, BLACK]);
    const { payload } = chessGame.logContext(
      engine.state,
      WHITE,
      chessGame.legalMoves(engine.state, WHITE),
    );
    expect(typeof payload["turn"]).toBe("number");
    expect(payload["turn"]).toBe(1);
    expect(payload["phase"]).toBe("move");
  });
});
