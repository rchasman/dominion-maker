/**
 * Hook for syncing state to localStorage
 * Consolidates all useSyncToLocalStorage calls
 */

import { useEffect } from "react";
import { useSyncToLocalStorage } from "../hooks/useSyncToLocalStorage";
import type { GameEvent } from "../events/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings } from "../agent/game-agent";
import type { GameMode } from "../types/game-mode";
import { STORAGE_KEYS } from "./storage-utils";
import { abortOngoingConsensus } from "../agent/game-agent";

type PlayerStrategyData = Record<
  string,
  {
    gameplan: string;
    read: string;
    lines: string;
  }
>;

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
      const trimmedLogs = logs.slice(-10000);
      return JSON.stringify(trimmedLogs);
    },
  });

  useSyncToLocalStorage(
    STORAGE_KEYS.MODEL_SETTINGS,
    {
      enabledModels: Array.from(modelSettings.enabledModels),
      consensusCount: modelSettings.consensusCount,
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
