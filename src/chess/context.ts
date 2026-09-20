import { batch, signal } from "@preact/signals";
import { z } from "zod";
import { uiLogger } from "../lib/logger";
import { run } from "../lib/run";
import type { ChessEngine } from "./engine";
import { loadChessEngine } from "./engine";
import { chessEventSchema } from "./schemas";
import type { ChessEvent, ChessState } from "./shape";

export const CHESS_EVENTS_KEY = "dominion-maker-chess-events";

export const chessState$ = signal<ChessState | null>(null);
export const chessEvents$ = signal<ChessEvent[]>([]);

const storedLogSchema = z.array(chessEventSchema);

export function clearStoredChessGame(): void {
  try {
    localStorage.removeItem(CHESS_EVENTS_KEY);
  } catch (error) {
    uiLogger.warn("Could not clear the saved chess game", { error });
  }
}

/**
 * The saved game, or null when there is none. A log that fails the schema or
 * that the engine refuses to replay is discarded and reported, never repaired:
 * a quietly patched log would show a position nobody played.
 */
export function restoreChessEngine(): ChessEngine | null {
  const saved = run(() => {
    try {
      return localStorage.getItem(CHESS_EVENTS_KEY);
    } catch (error) {
      uiLogger.error("Could not read the saved chess game", { error });
      return null;
    }
  });
  if (saved === null || saved === "") return null;
  try {
    const events = storedLogSchema.parse(JSON.parse(saved));
    if (events.length === 0) return null;
    return loadChessEngine(events);
  } catch (error) {
    uiLogger.error("Discarded a saved chess game that would not replay", {
      error,
    });
    clearStoredChessGame();
    return null;
  }
}

export function saveChessEvents(events: readonly ChessEvent[]): void {
  try {
    localStorage.setItem(CHESS_EVENTS_KEY, JSON.stringify(events));
  } catch (error) {
    uiLogger.warn("Could not save the chess game", { error });
  }
}

/** Writes the engine's log and state where the chess UI reads them */
export function syncChessEngine(engine: {
  eventLog: readonly ChessEvent[];
  state: ChessState;
}): void {
  batch(() => {
    chessEvents$.value = [...engine.eventLog];
    chessState$.value = engine.state;
  });
}
