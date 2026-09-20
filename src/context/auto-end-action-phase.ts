import { effect, type ReadonlySignal } from "@preact/signals";
import type { GameState } from "../types/game-state";
import { hasPlayableActions } from "./derived-state";
import { TIMING } from "./game-constants";

/**
 * A human with nothing to play in the action phase moves on without clicking.
 * Returns the disposer for the underlying effect.
 */
export function autoEndActionPhase(deps: {
  gameState: ReadonlySignal<GameState | null>;
  localPlayerId: ReadonlySignal<string | null>;
  endPhase: () => void;
}): () => void {
  const { gameState, localPlayerId, endPhase } = deps;
  return effect(() => {
    const state = gameState.value;
    const player = localPlayerId.value;
    if (!state || player === null) return;
    const idle =
      state.phase === "action" &&
      state.activePlayerId === player &&
      !state.pendingChoice &&
      !state.gameOver &&
      !hasPlayableActions(state, player);
    if (!idle) return;
    const timer = setTimeout(endPhase, TIMING.AUTO_ADVANCE_DELAY);
    return () => clearTimeout(timer);
  });
}
