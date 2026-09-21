import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../happy-dom.test-fixture";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { STORAGE_KEYS } from "../context/storage-utils";
import { createChessGame, loadChessEngine } from "../chess/engine";
import { chessEventSchema } from "../chess/schemas";
import { createGameStorage } from "./game-storage";

beforeAll(registerHappyDom);

const EVENTS_KEY = "dominion-maker-test-events";
const SEATS_KEY = "dominion-maker-test-seats";
const storage = createGameStorage({
  label: "test",
  eventsKey: EVENTS_KEY,
  seatsKey: SEATS_KEY,
  eventSchema: chessEventSchema,
  loadEngine: loadChessEngine,
});

const TABLE = { w: HUMAN_SEAT, b: HEURISTIC_SEAT };
const DOMINION_TABLE = JSON.stringify({
  human: HUMAN_SEAT,
  ai: HEURISTIC_SEAT,
});

/**
 * One sequential test: localStorage is one object shared with every other test
 * file, so these cases may not run beside each other, and clearing the whole
 * store would pull keys out from under a file that is still running.
 */
describe("a game's stored table", () => {
  beforeEach(() => {
    localStorage.removeItem(EVENTS_KEY);
    localStorage.removeItem(SEATS_KEY);
    localStorage.removeItem(STORAGE_KEYS.SEATS);
  });

  it("keeps a key of its own and leaves Dominion's alone", () => {
    expect(storage.loadSeats()).toBeNull();

    localStorage.setItem(STORAGE_KEYS.SEATS, DOMINION_TABLE);
    storage.saveSeats(TABLE);

    expect(storage.loadSeats()).toEqual(TABLE);
    expect(localStorage.getItem(STORAGE_KEYS.SEATS)).toBe(DOMINION_TABLE);

    // A new game clears the saved game and leaves the live table alone, so a
    // reload right after it must still find the table being played on
    storage.clearGame();
    expect(storage.loadSeats()).toEqual(TABLE);
    expect(localStorage.getItem(STORAGE_KEYS.SEATS)).toBe(DOMINION_TABLE);

    localStorage.setItem(SEATS_KEY, "not-json");
    expect(storage.loadSeats()).toBeNull();
    localStorage.setItem(SEATS_KEY, JSON.stringify({ w: { kind: "remote" } }));
    expect(storage.loadSeats()).toBeNull();

    // A saved log comes back as the engine that replays it; one that will not
    // replay is discarded rather than patched
    const engine = createChessGame(["w", "b"]);
    const played = engine.dispatch({ type: "MOVE", playerId: "w", san: "e4" });
    if (!played.ok) throw new Error(played.error);
    storage.saveEvents(engine.eventLog);
    expect(storage.restoreEngine()?.state.moves).toEqual(["e4"]);

    localStorage.setItem(
      EVENTS_KEY,
      JSON.stringify([{ type: "MOVE", playerId: "w", san: "e4" }]),
    );
    expect(storage.restoreEngine()).toBeNull();
    expect(localStorage.getItem(EVENTS_KEY)).toBeNull();

    localStorage.removeItem(SEATS_KEY);
    localStorage.removeItem(STORAGE_KEYS.SEATS);
  });
});
