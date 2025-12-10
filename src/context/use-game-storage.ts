/**
 * Custom hook for game storage management
 * Handles localStorage persistence and restoration
 */

import { useState } from "react";
import type { GameEvent } from "../events/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings } from "../agent/game-agent";
import { DEFAULT_MODEL_SETTINGS } from "../agent/game-agent";
import type { GameMode } from "../types/game-mode";
import type { GameState } from "../types/game-state";
import { DominionEngine } from "../engine";
import { uiLogger } from "../lib/logger";
import {
  loadGameMode,
  loadEvents,
  loadLLMLogs,
  loadModelSettings,
  loadPlayerStrategies,
  clearGameStorage,
  STORAGE_KEYS,
} from "./storage-utils";

type PlayerStrategyData = Record<
  string,
  {
    gameplan: string;
    read: string;
    lines: string;
  }
>;

interface GameStorageState {
  gameState: GameState | null;
  events: GameEvent[];
  gameMode: GameMode;
  isLoading: boolean;
  llmLogs: LLMLogEntry[];
  modelSettings: ModelSettings;
  playerStrategies: PlayerStrategyData;
  engineRef: DominionEngine | null;
}

/**
 * Load all game storage synchronously
 * Returns immediately with restored state or defaults
 */
export function useGameStorage(): GameStorageState {
  const [storage] = useState<GameStorageState>(() => {
    try {
      const gameMode = loadGameMode();
      const llmLogs = loadLLMLogs();
      const modelSettings = loadModelSettings() ?? DEFAULT_MODEL_SETTINGS;
      const playerStrategies = loadPlayerStrategies();

      const savedEvents = loadEvents();
      if (savedEvents) {
        try {
          const engine = new DominionEngine();
          engine.loadEvents(savedEvents);
          const restoredState = engine.state;

          uiLogger.info(`Restored game from ${savedEvents.length} events`);
          return {
            gameState: restoredState,
            events: savedEvents,
            gameMode,
            isLoading: false,
            llmLogs,
            modelSettings,
            playerStrategies,
            engineRef: engine,
          };
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

      return {
        gameState: null,
        events: [],
        gameMode,
        isLoading: false,
        llmLogs,
        modelSettings,
        playerStrategies,
        engineRef: null,
      };
    } catch (error: unknown) {
      uiLogger.error("Failed to restore game storage", { error });
      return {
        gameState: null,
        events: [],
        gameMode: "engine",
        isLoading: false,
        llmLogs: [],
        modelSettings: DEFAULT_MODEL_SETTINGS,
        playerStrategies: {},
        engineRef: null,
      };
    }
  });

  return storage;
}
