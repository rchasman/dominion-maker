import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { registerHappyDom } from "../happy-dom.test-fixture";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { STORAGE_KEYS } from "../context/storage-utils";
import {
  clearStoredChessGame,
  loadChessSeats,
  saveChessSeats,
} from "./context";

beforeAll(registerHappyDom);

const CHESS_SEATS_KEY = "dominion-maker-chess-seats";
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
describe("the stored chess table", () => {
  beforeEach(() => {
    localStorage.removeItem(CHESS_SEATS_KEY);
    localStorage.removeItem(STORAGE_KEYS.SEATS);
  });

  it("keeps a key of its own and leaves Dominion's alone", () => {
    expect(loadChessSeats()).toBeNull();

    localStorage.setItem(STORAGE_KEYS.SEATS, DOMINION_TABLE);
    saveChessSeats(TABLE);

    expect(loadChessSeats()).toEqual(TABLE);
    expect(localStorage.getItem(STORAGE_KEYS.SEATS)).toBe(DOMINION_TABLE);

    // A new game clears the saved game and leaves the live table alone, so a
    // reload right after it must still find the table being played on
    clearStoredChessGame();
    expect(loadChessSeats()).toEqual(TABLE);
    expect(localStorage.getItem(STORAGE_KEYS.SEATS)).toBe(DOMINION_TABLE);

    localStorage.setItem(CHESS_SEATS_KEY, "not-json");
    expect(loadChessSeats()).toBeNull();
    localStorage.setItem(
      CHESS_SEATS_KEY,
      JSON.stringify({ w: { kind: "remote" } }),
    );
    expect(loadChessSeats()).toBeNull();

    localStorage.removeItem(CHESS_SEATS_KEY);
    localStorage.removeItem(STORAGE_KEYS.SEATS);
  });
});
