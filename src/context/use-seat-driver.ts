import type { MutableRef } from "preact/hooks";
import { useEffect, useMemo } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { LLMLogger } from "../core/consensus/types";
import { TIMING } from "./game-constants";
import { createSeatDriver } from "./seat-driver";
import type { OpponentAnimator } from "./opponent-animations";
import { gameState$, seats$ } from "./game-signals";

/** Drives every non-human seat; see createSeatDriver for the rules */
export function useSeatDriver(
  engineRef: MutableRef<DominionEngine | null>,
  logger: LLMLogger,
  animation: OpponentAnimator | null,
  stepDelayMs: number = TIMING.AI_STEP_DELAY,
): void {
  const driver = useMemo(
    () => createSeatDriver({ engineRef, logger, animation, stepDelayMs }),
    [engineRef, logger, animation, stepDelayMs],
  );
  const gameState = gameState$.value;
  const seats = seats$.value;

  useEffect(() => {
    driver.update(gameState, seats);
  }, [driver, gameState, seats]);

  useEffect(() => () => driver.dispose(), [driver]);
}
