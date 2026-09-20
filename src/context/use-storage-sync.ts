/**
 * Hook for syncing a local Dominion session's state to localStorage
 */

import { useEffect, useRef } from "preact/hooks";
import { useSyncToLocalStorage } from "../hooks/useSyncToLocalStorage";
import { clearGameStateStorage, STORAGE_KEYS } from "./storage-utils";
import type { LocalDominionSession } from "./dominion-session";

// Keep only the last 10,000 entries to prevent localStorage quota exceeded errors
const MAX_LLM_LOGS = 10000;

/**
 * A finished game is never persisted: once gameOver flips true, the saved
 * game is cleared instead, so reloading the app never resurrects it. A new
 * game at the same table clears the previous game's keys before its own
 * writes land, so a reload never mixes the two.
 */
export function useStorageSync(session: LocalDominionSession): void {
  const events = session.events.value;
  const seats = session.seats.value;
  const llmLogs = session.llmLogs.value;
  const playerStrategies = session.playerStrategies.value;
  const gameOver = session.state.value?.gameOver ?? false;
  const gameIdentity = events[0]?.id;
  const previousIdentity = useRef(gameIdentity);

  useEffect(() => {
    if (gameOver) clearGameStateStorage();
  }, [gameOver]);

  useEffect(() => {
    if (previousIdentity.current !== gameIdentity) clearGameStateStorage();
    previousIdentity.current = gameIdentity;
  }, [gameIdentity]);

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
