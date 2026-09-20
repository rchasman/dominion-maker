import type { MutableRef } from "preact/hooks";
import { useEffect, useMemo } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { LLMLogger } from "../core/consensus/types";
import { createSeatDriver } from "../core/seat-driver";
import { dominionGame } from "../dominion/definition";
import { dominionModule } from "../dominion/module";
import { httpDecideMove, httpVerifyMove } from "../agent/http-decide-move";
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
  playerStrategies$,
  seats$,
  syncEngineToSignals,
} from "./game-signals";

/** Drives every non-human Dominion seat; see createSeatDriver for the rules */
export function useSeatDriver(
  engineRef: MutableRef<DominionEngine | null>,
  logger: LLMLogger,
  animation: OpponentAnimator | null,
  stepDelayMs: number = TIMING.AI_STEP_DELAY,
): void {
  const driver = useMemo(
    () =>
      createSeatDriver({
        game: dominionGame,
        engineRef,
        controllerFor: createBrowserControllers(dominionModule, logger, {
          decideMove: httpDecideMove(dominionModule),
          verifyMove: httpVerifyMove("", logger),
          getPlayerStrategies: () => playerStrategies$.peek(),
        }),
        logger,
        animation: animation
          ? {
              play: (events, signal) =>
                animateOpponentEvents(events, animation, signal),
            }
          : null,
        stepDelayMs,
        onSync: (events, state) =>
          syncEngineToSignals({ eventLog: events, state }),
        getSeats: () => seats$.peek(),
        setProcessing: processing => {
          isProcessing$.value = processing;
        },
        localPlayerId: () => localPlayerId$.peek(),
      }),
    [engineRef, logger, animation, stepDelayMs],
  );
  const gameState = gameState$.value;
  const seats = seats$.value;

  useEffect(() => {
    driver.update(gameState, seats);
  }, [driver, gameState, seats]);

  useEffect(() => () => driver.dispose(), [driver]);
}
