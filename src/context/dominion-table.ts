/**
 * Which table a local Dominion session opens with: the saved game when one
 * is still in progress and fully seated, otherwise a fresh one from the
 * chosen preset.
 */

import { DominionEngine } from "../engine";
import type { GameEvent } from "../events/types";
import type { PlayerId } from "../types/game-state";
import type { PlayerStrategyData } from "../types/player-strategy";
import type { LLMLogEntry } from "../core/consensus/types";
import type { Seats } from "../core/seats";
import { loadSeatPreset } from "../core/seat-presets";
import { uiLogger } from "../lib/logger";
import {
  clearGameStateStorage,
  loadEvents,
  loadLLMLogs,
  loadPlayerStrategies,
  loadSeats,
} from "./storage-utils";
import { SEAT_PRESETS } from "./seat-presets";

/** The table a local session opens with: a saved game, or a fresh one */
export type DominionTable =
  | {
      kind: "restore";
      events: GameEvent[];
      seats: Seats;
      llmLogs: LLMLogEntry[];
      playerStrategies: PlayerStrategyData;
    }
  | { kind: "new"; players: PlayerId[]; seats: Seats; seed?: number };

function freshTable(): DominionTable {
  clearGameStateStorage();
  const preset = SEAT_PRESETS[loadSeatPreset()];
  const players = preset.players();
  return { kind: "new", players, seats: preset.seats(players) };
}

function savedTable(): DominionTable | null {
  const events = loadEvents();
  const seats = loadSeats();
  if (!events || !seats) {
    if (events) uiLogger.info("Saved game had no seats, starting fresh");
    return null;
  }
  try {
    const engine = new DominionEngine();
    engine.loadEventsSilently(events);
    const state = engine.state;
    if (state.gameOver) {
      uiLogger.info("Saved game had already ended, starting fresh");
      return null;
    }
    if (!state.playerOrder.every(id => id in seats)) {
      uiLogger.info("Saved game had unseated players, starting fresh");
      return null;
    }
  } catch (error: unknown) {
    uiLogger.error("Failed to restore events, starting fresh", {
      error,
      eventCount: events.length,
    });
    return null;
  }
  uiLogger.info(`Restored game from ${events.length} events`);
  return {
    kind: "restore",
    events,
    seats,
    llmLogs: loadLLMLogs(),
    playerStrategies: loadPlayerStrategies(),
  };
}

export function loadDominionTable(): DominionTable {
  try {
    return savedTable() ?? freshTable();
  } catch (error: unknown) {
    uiLogger.error("Failed to read game storage", { error });
    return freshTable();
  }
}
