import { describe, it, expect } from "bun:test";
import { driveEngine } from "../core/driver";
import { heuristicController } from "../core/controller";
import { llmController } from "../core/llm-controller";
import type { DecideMove } from "../core/llm-controller";
import type { Seats } from "../core/seats";
import { goModule } from "./module";
import { goGame } from "./definition";
import { sideToMove } from "./engine";
import type { GoPlayerId, GoShape, GoStonePlaced } from "./shape";

const MOVE_CAP = 1500;

const isStoneEvent = (
  event: { type: string } & Record<string, unknown>,
): event is GoStonePlaced => event.type === "STONE_PLACED";

describe("Go driver integration", () => {
  it("finishes a heuristic vs heuristic game by passes within the move cap", async () => {
    const engine = goModule.createEngine(["b", "w"], { size: 9 });
    const seats: Seats<GoPlayerId> = {
      b: { kind: "heuristic" },
      w: { kind: "heuristic" },
    };
    const abort = new AbortController();
    const progress = { moves: 0 };
    const refused: string[] = [];

    await driveEngine(engine, {
      game: goGame,
      getSeats: () => seats,
      controllerFor: config =>
        config.kind === "heuristic" ? heuristicController(goGame) : null,
      onStep: () => {
        progress.moves += 1;
        if (progress.moves >= MOVE_CAP) abort.abort();
      },
      stepDelayMs: 0,
      minRetryDelayMs: 0,
      signal: abort.signal,
      logError: message => {
        refused.push(message);
        abort.abort();
      },
    });

    // A refused dispatch is an illegal move from the heuristic
    expect(refused).toEqual([]);
    if (progress.moves >= MOVE_CAP) {
      throw new Error(
        `Heuristic vs heuristic did not finish within ${MOVE_CAP} moves; final board: ${engine.state.board}`,
      );
    }
    const { result, score } = engine.state;
    expect(engine.state.gameOver).toBe(true);
    expect(result).toBe("score");
    expect(engine.state.consecutivePasses).toBe(2);
    expect(score).not.toBeNull();
    if (score === null)
      throw new Error("Expected a score once the game is over");
    expect(score.black + score.white).toBeGreaterThan(0);
    expect(engine.state.winnerId).not.toBeNull();
    expect(engine.eventLog.filter(isStoneEvent).length).toBeGreaterThan(20);
  }, 60000);

  it("plays five moves with a stubbed llm controller and never throws", async () => {
    const engine = goModule.createEngine(["b", "w"], { size: 9 });
    const stubDecideMove: DecideMove<GoShape> = ({ state }) => {
      const mover = sideToMove(state);
      const moves = goGame.legalMoves(state, mover);
      const move = moves[0];
      if (move === undefined) throw new Error("No legal move to stub");
      return Promise.resolve({ move, distribution: [] });
    };

    const seats: Seats<GoPlayerId> = {
      b: { kind: "llm", models: [], consensusCount: 1, customStrategy: "" },
      w: { kind: "heuristic" },
    };
    const abort = new AbortController();
    const progress = { moves: 0 };

    await driveEngine(engine, {
      game: goGame,
      getSeats: () => seats,
      controllerFor: config => {
        if (config.kind === "llm") {
          return llmController(goGame, config, {
            decideMove: stubDecideMove,
            getPlayerStrategies: () => ({}),
          });
        }
        if (config.kind === "heuristic") return heuristicController(goGame);
        return null;
      },
      onStep: () => {
        progress.moves += 1;
        if (progress.moves >= 5) abort.abort();
      },
      stepDelayMs: 0,
      signal: abort.signal,
    });

    expect(progress.moves).toBe(5);
    expect(engine.eventLog.filter(isStoneEvent)).toHaveLength(5);
  }, 15000);
});
