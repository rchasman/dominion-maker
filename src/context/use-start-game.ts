import { invalidateStrategyAnalysis } from "./use-strategy-analysis";
/**
 * Hook for starting a new game
 * Writes directly to signals instead of using setters.
 */

import { useCallback } from "preact/hooks";
import { DominionEngine } from "../engine";
import { uiLogger } from "../lib/logger";
import { clearGameStateStorage } from "./storage-utils";
import { SEAT_PRESETS } from "./seat-presets";
import { loadSeatPreset } from "../core/seat-presets";
import {
  syncEngineToSignals,
  events$,
  gameState$,
  llmLogs$,
  playerStrategies$,
  isProcessing$,
  seats$,
} from "./game-signals";

/**
 * A new game keeps the current table when one exists; otherwise the chosen preset seats it.
 */
export function useStartGame(
  setEngine: (engine: DominionEngine) => void,
): () => void {
  return useCallback(() => {
    isProcessing$.value = false;
    invalidateStrategyAnalysis();

    const currentOrder = gameState$.peek()?.playerOrder ?? [];
    const currentSeats = seats$.peek();
    const keepTable =
      currentOrder.length > 0 && currentOrder.every(id => id in currentSeats);
    const preset = SEAT_PRESETS[loadSeatPreset()];
    const players = keepTable ? currentOrder : preset.players();
    const seats = keepTable ? currentSeats : preset.seats(players);

    clearGameStateStorage();
    llmLogs$.value = [];
    playerStrategies$.value = {};
    events$.value = [];

    const newEngine = new DominionEngine();
    setEngine(newEngine);
    const result = newEngine.dispatch({ type: "START_GAME", players });

    if (result.ok) {
      seats$.value = seats;
      syncEngineToSignals(newEngine);
    } else {
      uiLogger.error("Failed to start game", { error: result.error });
    }
  }, [setEngine]);
}
