/**
 * Custom hook for game storage management
 * Handles localStorage persistence and restoration
 */

import { useState, useEffect } from "react";
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
 * Hook to manage game storage restoration
 */
export function useGameStorage(): GameStorageState {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [gameMode] = useState<GameMode>(loadGameMode);
  const [isLoading, setIsLoading] = useState(true);
  const [llmLogs, setLLMLogs] = useState<LLMLogEntry[]>([]);
  const [modelSettings, setModelSettings] = useState<ModelSettings>(
    DEFAULT_MODEL_SETTINGS,
  );
  const [playerStrategies, setPlayerStrategies] = useState<PlayerStrategyData>(
    {},
  );
  const [engineRef, setEngineRef] = useState<DominionEngine | null>(null);

  useEffect(() => {
    try {
      const savedLogs = loadLLMLogs();
      setLLMLogs(savedLogs);

      const savedSettings = loadModelSettings();
      if (savedSettings) {
        setModelSettings(savedSettings);
      }

      const savedStrategies = loadPlayerStrategies();
      setPlayerStrategies(savedStrategies);

      const savedEvents = loadEvents();
      if (savedEvents) {
        try {
          const engine = new DominionEngine();
          engine.loadEvents(savedEvents);
          const restoredState = engine.state;

          uiLogger.info(`Restored game from ${savedEvents.length} events`);
          setEngineRef(engine);
          setEvents(savedEvents);
          setGameState(restoredState);
        } catch (eventError: unknown) {
          uiLogger.error(
            "Failed to restore events, clearing only event storage",
            {
              error: eventError,
              eventCount: savedEvents.length,
            },
          );
          // Only clear events, preserve settings and logs
          localStorage.removeItem(STORAGE_KEYS.EVENTS);
        }
      }
    } catch (error: unknown) {
      uiLogger.error("Failed to restore game storage", { error });
      // Don't clear storage on general errors, just log
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    gameState,
    events,
    gameMode,
    isLoading,
    llmLogs,
    modelSettings,
    playerStrategies,
    engineRef,
  };
}
