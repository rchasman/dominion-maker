/**
 * Hook for starting a new game
 * Writes directly to signals instead of using setters.
 */

import { useCallback } from "preact/hooks";
import { DominionEngine } from "../engine";
import { getPlayersForMode } from "../types/game-mode";
import { abortOngoingConsensus } from "../agent/game-agent";
import { uiLogger } from "../lib/logger";
import { clearGameStateStorage } from "./storage-utils";
import {
  syncEngineToSignals,
  events$,
  llmLogs$,
  playerStrategies$,
  gameMode$,
} from "./game-signals";

/**
 * Hook to create startGame callback
 */
export function useStartGame(
  setEngine: (engine: DominionEngine) => void,
): () => void {
  return useCallback(() => {
    abortOngoingConsensus();
    clearGameStateStorage();

    // Clear signals immediately
    llmLogs$.value = [];
    playerStrategies$.value = {};
    events$.value = [];

    const newEngine = new DominionEngine();
    setEngine(newEngine);

    const gameMode = gameMode$.value;
    const players =
      gameMode === "multiplayer"
        ? ["human", "ai"]
        : getPlayersForMode(gameMode);

    const result = newEngine.dispatch({
      type: "START_GAME",
      players,
    });

    if (result.ok) {
      syncEngineToSignals(newEngine);
    } else {
      uiLogger.error("Failed to start game", { error: result.error });
    }
  }, [setEngine]);
}
