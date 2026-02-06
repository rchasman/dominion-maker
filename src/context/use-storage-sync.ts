/**
 * Hook for syncing state to localStorage
 * Reads directly from signals instead of taking state params.
 */

import { useEffect } from "preact/hooks";
import { useSyncToLocalStorage } from "../hooks/useSyncToLocalStorage";
import { STORAGE_KEYS } from "./storage-utils";
import { abortOngoingConsensus } from "../agent/game-agent";
import {
  events$,
  gameMode$,
  llmLogs$,
  modelSettings$,
  playerStrategies$,
} from "./game-signals";

/**
 * Hook to sync all game state from signals to localStorage
 */
export function useStorageSync(): void {
  const events = events$.value;
  const gameMode = gameMode$.value;
  const llmLogs = llmLogs$.value;
  const currentModelSettings = modelSettings$.value;
  const playerStrategies = playerStrategies$.value;

  useSyncToLocalStorage(STORAGE_KEYS.EVENTS, events, {
    shouldSync: events.length > 0,
  });

  useSyncToLocalStorage(STORAGE_KEYS.MODE, gameMode);

  useSyncToLocalStorage(STORAGE_KEYS.LLM_LOGS, llmLogs, {
    shouldSync: llmLogs.length > 0,
    serialize: logs => {
      // Keep only the last 10,000 entries to prevent localStorage quota exceeded errors
      const MAX_LLM_LOGS = 10000;
      const trimmedLogs = logs.slice(-MAX_LLM_LOGS);
      return JSON.stringify(trimmedLogs);
    },
  });

  useSyncToLocalStorage(
    STORAGE_KEYS.MODEL_SETTINGS,
    {
      enabledModels: Array.from(currentModelSettings.enabledModels),
      consensusCount: currentModelSettings.consensusCount,
      customStrategy: currentModelSettings.customStrategy,
      dataFormat: currentModelSettings.dataFormat,
    },
    {
      shouldSync: true,
    },
  );

  useSyncToLocalStorage(STORAGE_KEYS.STRATEGIES, playerStrategies);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortOngoingConsensus();
    };
  }, []);
}
