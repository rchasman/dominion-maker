import type { MutableRef } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { GameEvent } from "../events/types";
import type { GameState } from "../types/game-state";
import type { ControllerConfig, Seats } from "../core/seats";
import type { LLMLogger } from "../core/consensus/types";
import { isHumanSeat, sameConfig } from "../core/seats";
import { driveEngine } from "../core/driver";
import { dominionGame } from "../dominion/definition";
import { dominionModule } from "../dominion/module";
import { httpDecideMove, httpVerifyMove } from "../agent/http-decide-move";
import { uiLogger } from "../lib/logger";
import { createBrowserControllers } from "./controllers";
import {
  animateOpponentEvents,
  type OpponentAnimator,
} from "./opponent-animations";
import {
  isProcessing$,
  localPlayerId$,
  playerStrategies$,
  seats$,
  syncEngineToSignals,
} from "./game-signals";

type Running = { abort: AbortController; config: ControllerConfig };

export type SeatDriver = {
  /** Call with every game state or seats change; starts, keeps or aborts the driver */
  update(gameState: GameState | null, seats: Seats): void;
  dispose(): void;
};

const forOtherPlayers = (
  events: readonly GameEvent[],
  localPlayerId: string | null,
): GameEvent[] =>
  events.filter(
    event => !("playerId" in event) || event.playerId !== localPlayerId,
  );

/**
 * Starts one driver whenever a non-human seat must act, aborts it when that
 * seat becomes human or its config changes, and animates each step.
 * Pure of Preact so it can be tested without a DOM.
 */
export function createSeatDriver(params: {
  engineRef: MutableRef<DominionEngine | null>;
  logger: LLMLogger;
  animation: OpponentAnimator | null;
  stepDelayMs: number;
}): SeatDriver {
  const { engineRef, logger, animation, stepDelayMs } = params;
  const controllerFor = createBrowserControllers(dominionModule, logger, {
    decideMove: httpDecideMove(dominionModule),
    verifyMove: httpVerifyMove("", logger),
    getPlayerStrategies: () => playerStrategies$.peek(),
  });
  const running: { current: Running | null } = { current: null };

  const stop = () => {
    running.current?.abort.abort();
    running.current = null;
    isProcessing$.value = false;
  };

  return {
    update(gameState, seats) {
      const engine = engineRef.current;
      if (!engine || !gameState) return;
      const player = dominionGame.whoMustAct(gameState);
      const config = player === null ? undefined : seats[player];

      const current = running.current;
      if (current) {
        const stillValid =
          config !== undefined &&
          !isHumanSeat(config) &&
          sameConfig(config, current.config);
        if (stillValid) return;
        stop();
      }
      if (player === null || config === undefined || isHumanSeat(config)) {
        return;
      }

      const abort = new AbortController();
      running.current = { abort, config };
      isProcessing$.value = true;
      void driveEngine(engine, {
        game: dominionGame,
        getSeats: () => seats$.peek(),
        controllerFor,
        onStep: async events => {
          if (animation) {
            await animateOpponentEvents(
              forOtherPlayers(events, localPlayerId$.peek()),
              animation,
              abort.signal,
            );
          }
          if (!abort.signal.aborted) syncEngineToSignals(engine);
        },
        stepDelayMs,
        signal: abort.signal,
        logError: message => {
          uiLogger.error(message);
          logger({
            type: "consensus-step-error",
            message,
            data: { error: message },
          });
        },
      }).finally(() => {
        if (running.current?.abort !== abort) return;
        running.current = null;
        isProcessing$.value = false;
        syncEngineToSignals(engine);
      });
    },
    dispose: stop,
  };
}
