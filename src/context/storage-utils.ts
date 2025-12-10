/**
 * Storage utilities for GameContext
 * Handles localStorage operations with proper error handling
 */

import type { GameEvent } from "../events/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings, ModelProvider } from "../agent/game-agent";
import type { GameMode } from "../types/game-mode";

// Storage keys
export const STORAGE_KEYS = {
  EVENTS: "dominion-maker-sp-events",
  MODE: "dominion-maker-game-mode",
  LLM_LOGS: "dominion-maker-llm-logs",
  MODEL_SETTINGS: "dominion-maker-model-settings",
  STRATEGIES: "dominion-maker-strategies",
} as const;

// Valid game modes for validation
const VALID_GAME_MODES: GameMode[] = [
  "engine",
  "hybrid",
  "full",
  "multiplayer",
];

/**
 * Load game mode from localStorage with validation
 */
export function loadGameMode(): GameMode {
  const savedModeRaw = localStorage.getItem(STORAGE_KEYS.MODE);
  if (!savedModeRaw) {
    return "engine";
  }

  try {
    const savedMode = JSON.parse(savedModeRaw) as string;
    if (VALID_GAME_MODES.includes(savedMode as GameMode)) {
      return savedMode as GameMode;
    }
  } catch {
    // Invalid JSON, ignore
  }

  return "engine";
}

/**
 * Load events from localStorage
 */
export function loadEvents(): GameEvent[] | null {
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!savedEvents) {
    return null;
  }

  try {
    return JSON.parse(savedEvents) as GameEvent[];
  } catch {
    return null;
  }
}

/**
 * Load LLM logs from localStorage
 */
export function loadLLMLogs(): LLMLogEntry[] {
  const savedLogs = localStorage.getItem(STORAGE_KEYS.LLM_LOGS);
  if (!savedLogs) {
    return [];
  }

  try {
    return JSON.parse(savedLogs) as LLMLogEntry[];
  } catch {
    return [];
  }
}

/**
 * Load model settings from localStorage
 */
export function loadModelSettings(): ModelSettings | null {
  const savedSettings = localStorage.getItem(STORAGE_KEYS.MODEL_SETTINGS);
  if (!savedSettings) {
    return null;
  }

  try {
    const parsed = JSON.parse(savedSettings) as {
      enabledModels: ModelProvider[];
      consensusCount: number;
    };
    return {
      enabledModels: new Set(parsed.enabledModels),
      consensusCount: parsed.consensusCount,
    };
  } catch {
    return null;
  }
}

/**
 * Load player strategies from localStorage
 */
export function loadPlayerStrategies(): Record<
  string,
  {
    gameplan: string;
    read: string;
    lines: string;
  }
> {
  const savedStrategies = localStorage.getItem(STORAGE_KEYS.STRATEGIES);
  if (!savedStrategies) {
    return {};
  }

  try {
    return JSON.parse(savedStrategies) as Record<
      string,
      {
        gameplan: string;
        read: string;
        lines: string;
      }
    >;
  } catch {
    return {};
  }
}

/**
 * Clear all game-related storage
 */
export function clearGameStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.EVENTS);
  localStorage.removeItem(STORAGE_KEYS.MODE);
  localStorage.removeItem(STORAGE_KEYS.LLM_LOGS);
  localStorage.removeItem(STORAGE_KEYS.STRATEGIES);
  localStorage.removeItem(STORAGE_KEYS.MODEL_SETTINGS);
}

/**
 * Clear game state storage (events, logs, strategies) but preserve mode and settings
 */
export function clearGameStateStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.EVENTS);
  localStorage.removeItem(STORAGE_KEYS.LLM_LOGS);
  localStorage.removeItem(STORAGE_KEYS.STRATEGIES);
}
