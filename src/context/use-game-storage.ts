/**
 * Custom hook for game storage management
 * Writes restored state directly to signals on mount.
 */

import { useState } from "preact/hooks";
import { DEFAULT_MODEL_SETTINGS } from "../agent/game-agent";
import { DominionEngine } from "../engine";
import { uiLogger } from "../lib/logger";
import {
  loadGameMode,
  loadEvents,
  loadLLMLogs,
  loadModelSettings,
  loadPlayerStrategies,
  STORAGE_KEYS,
} from "./storage-utils";
import {
  gameState$,
  events$,
  gameMode$,
  isLoading$,
  llmLogs$,
  modelSettings$,
  playerStrategies$,
} from "./game-signals";

interface GameStorageResult {
  engineRef: DominionEngine | null;
}

/**
 * Load all game storage synchronously and write to signals.
 * Returns only the engine ref (signals own the state).
 */
export function useGameStorage(): GameStorageResult {
  const [storage] = useState<GameStorageResult>(() => {
    try {
      const gameMode = loadGameMode();
      const restoredLlmLogs = loadLLMLogs();
      const restoredModelSettings =
        loadModelSettings() ?? DEFAULT_MODEL_SETTINGS;
      const restoredPlayerStrategies = loadPlayerStrategies();

      // Write restored config to signals
      gameMode$.value = gameMode;
      llmLogs$.value = restoredLlmLogs;
      modelSettings$.value = restoredModelSettings;
      playerStrategies$.value = restoredPlayerStrategies;
      isLoading$.value = false;

      const savedEvents = loadEvents();
      if (savedEvents) {
        try {
          const engine = new DominionEngine();
          engine.loadEvents(savedEvents);

          uiLogger.info(`Restored game from ${savedEvents.length} events`);

          // Write restored game state to signals
          gameState$.value = engine.state;
          events$.value = savedEvents;

          return { engineRef: engine };
        } catch (eventError: unknown) {
          uiLogger.error(
            "Failed to restore events, clearing only event storage",
            {
              error: eventError,
              eventCount: savedEvents.length,
            },
          );
          localStorage.removeItem(STORAGE_KEYS.EVENTS);
        }
      }

      return { engineRef: null };
    } catch (error: unknown) {
      uiLogger.error("Failed to restore game storage", { error });
      // Signals already have sensible defaults
      isLoading$.value = false;
      return { engineRef: null };
    }
  });

  return storage;
}
