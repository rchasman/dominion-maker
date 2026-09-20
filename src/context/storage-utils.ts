/**
 * Storage utilities for the saved local game
 * Handles localStorage operations with proper error handling
 */

import type { GameEvent } from "../events/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { Seats } from "../core/seats";
import { seatsSchema } from "../validation/seats";

// Storage keys
export const STORAGE_KEYS = {
  EVENTS: "dominion-maker-sp-events",
  SEATS: "dominion-maker-seats",
  LLM_LOGS: "dominion-maker-llm-logs",
  STRATEGIES: "dominion-maker-strategies",
  PLAYER_NAME: "dominion-maker-player-name",
} as const;

/**
 * Load the seats of the saved game; null when absent or malformed
 */
export function loadSeats(): Seats | null {
  const saved = localStorage.getItem(STORAGE_KEYS.SEATS);
  if (!saved) return null;
  try {
    const parsed = seatsSchema.safeParse(JSON.parse(saved));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
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
 * Load player strategies from localStorage
 */
export function loadPlayerStrategies(): PlayerStrategyData {
  const savedStrategies = localStorage.getItem(STORAGE_KEYS.STRATEGIES);
  if (!savedStrategies) {
    return {};
  }

  try {
    return JSON.parse(savedStrategies) as PlayerStrategyData;
  } catch {
    return {};
  }
}

/**
 * Clear the saved game (events, seats, logs, strategies)
 */
export function clearGameStateStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.EVENTS);
  localStorage.removeItem(STORAGE_KEYS.SEATS);
  localStorage.removeItem(STORAGE_KEYS.LLM_LOGS);
  localStorage.removeItem(STORAGE_KEYS.STRATEGIES);
}
