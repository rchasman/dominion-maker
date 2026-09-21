/**
 * A game's saved local table: its event log under one key and the seats it
 * was played on under another. Each game binds its own keys, so no game ever
 * reads another game's table back as its own.
 */

import { z } from "zod";
import type { Seats } from "../core/seats";
import {
  loadSeatPreset,
  seatsFor,
  type SeatPreset,
  type TablePreset,
} from "../core/seat-presets";
import { uiLogger } from "../lib/logger";
import { run } from "../lib/run";
import { seatsSchema } from "../validation/seats";

export type GameStorage<Ev, E> = {
  readonly clearGame: () => void;
  /** The table the saved game was played on; null when absent or bad */
  readonly loadSeats: () => Seats | null;
  readonly saveSeats: (seats: Seats) => void;
  /**
   * The saved game, or null when there is none. A log that fails the schema
   * or that the engine refuses to replay is discarded and reported, never
   * repaired: a quietly patched log would show a position nobody played.
   */
  readonly restoreEngine: () => E | null;
  readonly saveEvents: (events: readonly Ev[]) => void;
};

export function createGameStorage<Ev, E>({
  label,
  eventsKey,
  seatsKey,
  eventSchema,
  loadEngine,
}: {
  /** How the game is named in the warnings, e.g. "chess" */
  label: string;
  eventsKey: string;
  seatsKey: string;
  eventSchema: z.ZodType<Ev>;
  loadEngine: (events: readonly Ev[]) => E;
}): GameStorage<Ev, E> {
  const storedLogSchema = z.array(eventSchema);

  const clearGame = () => {
    try {
      localStorage.removeItem(eventsKey);
    } catch (error) {
      uiLogger.warn(`Could not clear the saved ${label} game`, { error });
    }
  };

  return {
    clearGame,
    loadSeats: () => {
      const saved = run(() => {
        try {
          return localStorage.getItem(seatsKey);
        } catch (error) {
          uiLogger.warn(`Could not read the saved ${label} table`, { error });
          return null;
        }
      });
      if (saved === null || saved === "") return null;
      try {
        const parsed = seatsSchema.safeParse(JSON.parse(saved));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
    saveSeats: seats => {
      try {
        localStorage.setItem(seatsKey, JSON.stringify(seats));
      } catch (error) {
        uiLogger.warn(`Could not save the ${label} table`, { error });
      }
    },
    restoreEngine: () => {
      const saved = run(() => {
        try {
          return localStorage.getItem(eventsKey);
        } catch (error) {
          uiLogger.error(`Could not read the saved ${label} game`, { error });
          return null;
        }
      });
      if (saved === null || saved === "") return null;
      try {
        const events = storedLogSchema.parse(JSON.parse(saved));
        if (events.length === 0) return null;
        return loadEngine(events);
      } catch (error) {
        uiLogger.error(
          `Discarded a saved ${label} game that would not replay`,
          { error },
        );
        clearGame();
        return null;
      }
    },
    saveEvents: events => {
      try {
        localStorage.setItem(eventsKey, JSON.stringify(events));
      } catch (error) {
        uiLogger.warn(`Could not save the ${label} game`, { error });
      }
    },
  };
}

/** The saved game when there is one, else a fresh one on the chosen preset */
export function openStoredTable<Ev, E>({
  storage,
  presets,
  players,
  createEngine,
}: {
  storage: GameStorage<Ev, E>;
  presets: Record<SeatPreset, TablePreset>;
  players: readonly string[];
  createEngine: () => E;
}): { engine: E; seats: Seats } {
  const restored = storage.restoreEngine();
  return {
    engine: restored ?? createEngine(),
    seats: seatsFor({
      presets,
      players,
      restored: restored !== null,
      saved: storage.loadSeats(),
      preset: loadSeatPreset(),
    }),
  };
}
