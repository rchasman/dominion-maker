import { useEffect } from "preact/hooks";
import { hasPlayableActions } from "./derived-state";
import { TIMING } from "./game-constants";
import { gameState$ } from "./game-signals";

/** A human with nothing to play in the action phase moves on without clicking */
export function useAutoEndActionPhase(params: {
  localPlayerId: string | null;
  endPhase: () => void;
}): void {
  const { localPlayerId, endPhase } = params;
  const gameState = gameState$.value;

  useEffect(() => {
    if (!gameState || localPlayerId === null) return;
    const idle =
      gameState.phase === "action" &&
      gameState.activePlayerId === localPlayerId &&
      !gameState.pendingChoice &&
      !gameState.gameOver &&
      !hasPlayableActions(gameState, localPlayerId);
    if (!idle) return;
    const timer = setTimeout(endPhase, TIMING.AUTO_ADVANCE_DELAY);
    return () => clearTimeout(timer);
  }, [gameState, localPlayerId, endPhase]);
}
