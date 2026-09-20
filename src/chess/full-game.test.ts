import { describe, it, expect } from "bun:test";
import { driveEngine } from "../core/driver";
import { heuristicController } from "../core/controller";
import { llmController } from "../core/llm-controller";
import type { DecideMove } from "../core/llm-controller";
import type { Seats } from "../core/seats";
import { chessModule } from "./module";
import { chessGame } from "./definition";
import { sideToMove } from "./engine";
import type { ChessMoved, ChessPlayerId, ChessShape } from "./shape";

const PLY_CAP = 600;

const isMoveEvent = (
  event: { type: string } & Record<string, unknown>,
): event is ChessMoved => event.type === "MOVE";

describe("chess driver integration", () => {
  it("finishes a heuristic vs heuristic game within the ply cap", async () => {
    const engine = chessModule.createEngine(["w", "b"], {});
    const seats: Seats<ChessPlayerId> = {
      w: { kind: "heuristic" },
      b: { kind: "heuristic" },
    };
    const abort = new AbortController();
    const progress = { plies: 0 };

    await driveEngine(engine, {
      game: chessGame,
      getSeats: () => seats,
      controllerFor: config =>
        config.kind === "heuristic" ? heuristicController(chessGame) : null,
      onStep: () => {
        progress.plies += 1;
        if (progress.plies >= PLY_CAP) abort.abort();
      },
      stepDelayMs: 0,
      signal: abort.signal,
    });

    if (progress.plies >= PLY_CAP) {
      throw new Error(
        `Heuristic vs heuristic did not finish within ${PLY_CAP} plies; final FEN: ${engine.state.fen}`,
      );
    }
    const { result } = engine.state;
    expect(engine.state.gameOver).toBe(true);
    expect(result).not.toBeNull();
    if (result === null)
      throw new Error("Expected a result once the game is over");
    expect(["checkmate", "stalemate", "draw"]).toContain(result);
  }, 30000);

  it("plays five plies with a stubbed llm controller and never throws", async () => {
    const engine = chessModule.createEngine(["w", "b"], {});
    const stubDecideMove: DecideMove<ChessShape> = ({ state }) => {
      const mover = sideToMove(state);
      const moves = chessGame.legalMoves(state, mover);
      const move = moves[0];
      if (move === undefined) throw new Error("No legal move to stub");
      return Promise.resolve({ move, distribution: [] });
    };

    const seats: Seats<ChessPlayerId> = {
      w: { kind: "llm", models: [], consensusCount: 1, customStrategy: "" },
      b: { kind: "heuristic" },
    };
    const abort = new AbortController();
    const progress = { plies: 0 };

    await driveEngine(engine, {
      game: chessGame,
      getSeats: () => seats,
      controllerFor: config => {
        if (config.kind === "llm") {
          return llmController(chessGame, config, {
            decideMove: stubDecideMove,
            getPlayerStrategies: () => ({}),
          });
        }
        if (config.kind === "heuristic") return heuristicController(chessGame);
        return null;
      },
      onStep: () => {
        progress.plies += 1;
        if (progress.plies >= 5) abort.abort();
      },
      stepDelayMs: 0,
      signal: abort.signal,
    });

    expect(progress.plies).toBe(5);
    expect(engine.eventLog.filter(isMoveEvent)).toHaveLength(5);
  }, 15000);
});
