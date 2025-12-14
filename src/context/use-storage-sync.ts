/**
 * Hook for syncing state to localStorage
 * Consolidates all useSyncToLocalStorage calls
 */

import { useEffect } from "preact/hooks";
import { useSyncToLocalStorage } from "../hooks/useSyncToLocalStorage";
import type { GameEvent } from "../events/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings } from "../agent/game-agent";
import type { GameMode } from "../types/game-mode";
import type { PlayerStrategyData } from "../types/player-strategy";
import { STORAGE_KEYS } from "./storage-utils";
import { abortOngoingConsensus } from "../agent/game-agent";

/**
 * Hook to sync all game state to localStorage
 */
export function useStorageSync(state: {
  events: GameEvent[];
  gameMode: GameMode;
  llmLogs: LLMLogEntry[];
  modelSettings: ModelSettings;
  playerStrategies: PlayerStrategyData;
}): void {
  const { events, gameMode, llmLogs, modelSettings, playerStrategies } = state;
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
      enabledModels: Array.from(modelSettings.enabledModels),
      consensusCount: modelSettings.consensusCount,
      customStrategy: modelSettings.customStrategy,
      dataFormat: modelSettings.dataFormat,
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
