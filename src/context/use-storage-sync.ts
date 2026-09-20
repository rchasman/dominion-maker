/**
 * Hook for syncing state to localStorage
 * Reads directly from signals instead of taking state params.
 */

import { useEffect } from "preact/hooks";
import { useSyncToLocalStorage } from "../hooks/useSyncToLocalStorage";
import { clearGameStateStorage, STORAGE_KEYS } from "./storage-utils";
import {
  events$,
  gameState$,
  llmLogs$,
  playerStrategies$,
  seats$,
} from "./game-signals";

// Keep only the last 10,000 entries to prevent localStorage quota exceeded errors
const MAX_LLM_LOGS = 10000;

/**
 * Hook to sync all game state from signals to localStorage.
 * A finished game is never persisted: once gameOver flips true, the saved
 * game is cleared instead, so reloading the app never resurrects it.
 */
export function useStorageSync(): void {
  const events = events$.value;
  const seats = seats$.value;
  const llmLogs = llmLogs$.value;
  const playerStrategies = playerStrategies$.value;
  const gameOver = gameState$.value?.gameOver ?? false;

  useEffect(() => {
    if (gameOver) clearGameStateStorage();
  }, [gameOver]);

  useSyncToLocalStorage(STORAGE_KEYS.EVENTS, events, {
    shouldSync: events.length > 0 && !gameOver,
  });

  useSyncToLocalStorage(STORAGE_KEYS.SEATS, seats, {
    shouldSync: Object.keys(seats).length > 0 && !gameOver,
  });

  useSyncToLocalStorage(STORAGE_KEYS.LLM_LOGS, llmLogs, {
    shouldSync: llmLogs.length > 0 && !gameOver,
    serialize: logs => JSON.stringify(logs.slice(-MAX_LLM_LOGS)),
  });

  useSyncToLocalStorage(STORAGE_KEYS.STRATEGIES, playerStrategies, {
    shouldSync: !gameOver,
  });
}
