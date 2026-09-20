import type { MutableRef } from "preact/hooks";
import { useEffect, useMemo } from "preact/hooks";
import type { LLMLogger } from "../core/consensus/types";
import { createSeatDriver } from "../core/seat-driver";
import { createBrowserControllers } from "../context/controllers";
import { httpDecideMove } from "../agent/http-decide-move";
import { TIMING } from "../context/game-constants";
import { isProcessing$, seats$ } from "../context/game-signals";
import { chessGame } from "./definition";
import { chessModule } from "./module";
import type { ChessEngine } from "./engine";
import { chessState$, syncChessEngine } from "./context";

/**
 * Drives every non-human chess seat. Chess has no evaluator, so no verifyMove,
 * and no per-player strategy analysis, so the strategy map is always empty.
 */
export function useChessSeatDriver(
  engineRef: MutableRef<ChessEngine | null>,
  logger: LLMLogger,
  localPlayerId: string | null,
): void {
  const driver = useMemo(
    () =>
      createSeatDriver({
        game: chessGame,
        engineRef,
        controllerFor: createBrowserControllers(chessModule, logger, {
          decideMove: httpDecideMove(chessModule),
          getPlayerStrategies: () => ({}),
        }),
        logger,
        stepDelayMs: TIMING.AI_STEP_DELAY,
        onSync: (events, state) => syncChessEngine({ eventLog: events, state }),
        getSeats: () => seats$.peek(),
        setProcessing: processing => {
          isProcessing$.value = processing;
        },
        localPlayerId: () => localPlayerId,
      }),
    [engineRef, logger, localPlayerId],
  );

  const state = chessState$.value;
  const seats = seats$.value;

  useEffect(() => {
    driver.update(state, seats);
  }, [driver, state, seats]);

  useEffect(() => () => driver.dispose(), [driver]);
}
