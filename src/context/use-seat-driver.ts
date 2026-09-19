import type { MutableRef } from "preact/hooks";
import { useEffect, useMemo, useRef } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { GameEvent } from "../events/types";
import type { ControllerConfig } from "../core/seats";
import type { LLMLogger } from "../core/consensus/types";
import { isHumanSeat, sameConfig } from "../core/seats";
import { driveEngine } from "../core/driver";
import { dominionGame } from "../dominion/definition";
import { uiLogger } from "../lib/logger";
import { TIMING } from "./game-constants";
import { createBrowserControllers } from "./controllers";
import {
  animateOpponentEvents,
  type OpponentAnimator,
} from "./opponent-animations";
import {
  gameState$,
  isProcessing$,
  localPlayerId$,
  seats$,
  syncEngineToSignals,
} from "./game-signals";

type Running = { abort: AbortController; config: ControllerConfig };

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
 */
export function useSeatDriver(
  engineRef: MutableRef<DominionEngine | null>,
  logger: LLMLogger,
  animation: OpponentAnimator | null,
): void {
  const running = useRef<Running | null>(null);
  const controllerFor = useMemo(
    () => createBrowserControllers(logger),
    [logger],
  );
  const gameState = gameState$.value;
  const seats = seats$.value;

  useEffect(() => {
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
      current.abort.abort();
      running.current = null;
      isProcessing$.value = false;
    }
    if (player === null || config === undefined || isHumanSeat(config)) return;

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
      stepDelayMs: TIMING.AI_STEP_DELAY,
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
  }, [gameState, seats, engineRef, controllerFor, animation, logger]);

  useEffect(
    () => () => {
      running.current?.abort.abort();
      running.current = null;
      isProcessing$.value = false;
    },
    [],
  );
}
