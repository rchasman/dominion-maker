/**
 * Which table a local session opens with: the saved game when one is still
 * in progress and fully seated, otherwise a fresh one from the chosen preset.
 */

import { DominionEngine } from "../engine";
import { uiLogger } from "../lib/logger";
import {
  clearGameStateStorage,
  loadEvents,
  loadLLMLogs,
  loadPlayerStrategies,
  loadSeats,
} from "../context/storage-utils";
import { SEAT_PRESETS, loadSeatPreset } from "../context/seat-presets";
import type { LocalTable } from "./create-local-session";

function freshTable(): LocalTable {
  clearGameStateStorage();
  const preset = SEAT_PRESETS[loadSeatPreset()];
  const players = preset.players();
  return { kind: "new", players, seats: preset.seats(players) };
}

function savedTable(): LocalTable | null {
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

export function loadLocalTable(): LocalTable {
  try {
    return savedTable() ?? freshTable();
  } catch (error: unknown) {
    uiLogger.error("Failed to read game storage", { error });
    return freshTable();
  }
}
