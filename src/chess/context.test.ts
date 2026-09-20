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

const TABLE = { w: HUMAN_SEAT, b: HEURISTIC_SEAT };
const DOMINION_TABLE = JSON.stringify({
  human: HUMAN_SEAT,
  ai: HEURISTIC_SEAT,
});

describe("the stored chess table", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips under a key of its own, leaving Dominion's alone", () => {
    localStorage.setItem(STORAGE_KEYS.SEATS, DOMINION_TABLE);

    saveChessSeats(TABLE);

    expect(loadChessSeats()).toEqual(TABLE);
    expect(localStorage.getItem(STORAGE_KEYS.SEATS)).toBe(DOMINION_TABLE);
  });

  it("reads nothing where nothing was stored, and refuses a bad table", () => {
    expect(loadChessSeats()).toBeNull();
    localStorage.setItem("dominion-maker-chess-seats", "not-json");
    expect(loadChessSeats()).toBeNull();
    localStorage.setItem(
      "dominion-maker-chess-seats",
      JSON.stringify({ w: { kind: "remote" } }),
    );
    expect(loadChessSeats()).toBeNull();
  });

  // A new game clears the saved game and leaves the live table alone, so a
  // reload right after it must still find the table being played on.
  it("survives the saved game being cleared", () => {
    localStorage.setItem(STORAGE_KEYS.SEATS, DOMINION_TABLE);
    saveChessSeats(TABLE);

    clearStoredChessGame();

    expect(loadChessSeats()).toEqual(TABLE);
    expect(localStorage.getItem(STORAGE_KEYS.SEATS)).toBe(DOMINION_TABLE);
  });
});
