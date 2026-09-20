/**
 * Custom hook for game storage management
 * Writes restored state directly to signals on mount.
 */

import { useState } from "preact/hooks";
import { DominionEngine } from "../engine";
import { uiLogger } from "../lib/logger";
import {
  clearGameStateStorage,
  loadEvents,
  loadLLMLogs,
  loadPlayerStrategies,
  loadSeats,
  STORAGE_KEYS,
} from "./storage-utils";
import {
  gameState$,
  events$,
  isLoading$,
  llmLogs$,
  playerStrategies$,
  seats$,
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
      const restoredLlmLogs = loadLLMLogs();
      const restoredPlayerStrategies = loadPlayerStrategies();
      const savedSeats = loadSeats();

      // Write restored config to signals
      llmLogs$.value = restoredLlmLogs;
      playerStrategies$.value = restoredPlayerStrategies;
      isLoading$.value = false;

      const savedEvents = loadEvents();
      if (savedEvents && !savedSeats) {
        uiLogger.info("Saved game had no seats, starting fresh");
        localStorage.removeItem(STORAGE_KEYS.EVENTS);
        return { engineRef: null };
      }
      if (savedEvents && savedSeats) {
        try {
          const engine = new DominionEngine();
          engine.loadEvents(savedEvents);

          if (engine.state.gameOver) {
            uiLogger.info("Saved game had already ended, starting fresh");
            clearGameStateStorage();
            return { engineRef: null };
          }

          seats$.value = savedSeats;

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
