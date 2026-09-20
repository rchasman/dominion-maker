import {
  beforeAll,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "bun:test";
import { registerHappyDom } from "../happy-dom.test-fixture";
import {
  loadEvents,
  loadLLMLogs,
  loadPlayerStrategies,
  loadSeats,
  clearGameStateStorage,
  STORAGE_KEYS,
} from "./storage-utils";
import { DEFAULT_LLM_SEAT, HUMAN_SEAT } from "../core/seats";
import type { GameEvent } from "../events/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type {
  PlayerStrategy,
  PlayerStrategyData,
} from "../types/player-strategy";

beforeAll(registerHappyDom);

describe("storage-utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("loadSeats", () => {
    it("returns null when nothing is stored", () => {
      expect(loadSeats()).toBeNull();
    });

    it("round-trips a seats record", () => {
      const seats = { human: HUMAN_SEAT, ai: DEFAULT_LLM_SEAT };
      localStorage.setItem(STORAGE_KEYS.SEATS, JSON.stringify(seats));
      expect(loadSeats()).toEqual(seats);
    });

    it("returns null for malformed JSON", () => {
      localStorage.setItem(STORAGE_KEYS.SEATS, "not-json");
      expect(loadSeats()).toBeNull();
    });

    it("rejects an unknown model id and an unknown kind", () => {
      localStorage.setItem(
        STORAGE_KEYS.SEATS,
        JSON.stringify({ ai: { ...DEFAULT_LLM_SEAT, models: ["nope"] } }),
      );
      expect(loadSeats()).toBeNull();
      localStorage.setItem(
        STORAGE_KEYS.SEATS,
        JSON.stringify({ ai: { kind: "remote" } }),
      );
      expect(loadSeats()).toBeNull();
    });
  });

  describe("loadEvents", () => {
    it("should return null when no events are stored", () => {
      expect(loadEvents()).toBeNull();
    });

    it("should return null when storage value is empty string", () => {
      localStorage.setItem(STORAGE_KEYS.EVENTS, "");
      expect(loadEvents()).toBeNull();
    });

    it("should return empty array when storing empty array", () => {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));
      const events = loadEvents();
      expect(events).toEqual([]);
    });

    it("should return parsed events when stored", () => {
      const testEvents: GameEvent[] = [
        { type: "TURN_STARTED", id: "event-1", playerId: "human", turn: 1 },
        { type: "TURN_ENDED", id: "event-2", playerId: "human", turn: 1 },
      ];
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(testEvents));
      expect(loadEvents()).toEqual(testEvents);
    });

    it("should return null when stored value is invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.EVENTS, "not-json");
      expect(loadEvents()).toBeNull();
    });

    it("should return null when stored value is null", () => {
      localStorage.setItem(STORAGE_KEYS.EVENTS, "null");
      expect(loadEvents()).toBeNull();
    });
  });

  describe("loadLLMLogs", () => {
    it("should return empty array when no logs are stored", () => {
      expect(loadLLMLogs()).toEqual([]);
    });

    it("should return empty array when storage is null", () => {
      localStorage.removeItem(STORAGE_KEYS.LLM_LOGS);
      expect(loadLLMLogs()).toEqual([]);
    });

    it("should return empty array when stored value is invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.LLM_LOGS, "not-json");
      expect(loadLLMLogs()).toEqual([]);
    });

    it("should return parsed logs when stored", () => {
      const testLogs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "consensus-skipped",
          message: "game started",
          data: { eventCount: 1 },
        },
      ];
      localStorage.setItem(STORAGE_KEYS.LLM_LOGS, JSON.stringify(testLogs));
      const logs = loadLLMLogs();
      expect(logs).toEqual(testLogs);
    });

    it("should return null when stored as null string (JSON.parse behavior)", () => {
      localStorage.setItem(STORAGE_KEYS.LLM_LOGS, "null");
      const result = loadLLMLogs() as LLMLogEntry[] | null;
      // JSON.parse("null") returns null literal, though TypeScript casts it to array
      // This is a limitation of the implementation - in practice, this shouldn't happen
      expect(result).toBe(null);
    });
  });

  describe("loadPlayerStrategies", () => {
    it("should return empty record when no strategies are stored", () => {
      expect(loadPlayerStrategies()).toEqual({});
    });

    it("should return empty record when storage is null", () => {
      localStorage.removeItem(STORAGE_KEYS.STRATEGIES);
      expect(loadPlayerStrategies()).toEqual({});
    });

    it("should return empty record when stored value is invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, "not-json");
      expect(loadPlayerStrategies()).toEqual({});
    });

    it("should return parsed strategies when stored as array", () => {
      const testStrategies: PlayerStrategyData = {
        human: {
          gameplan: "Buy villages",
          read: "Build engine",
          recommendation: "Keep smithies",
        },
      };
      localStorage.setItem(
        STORAGE_KEYS.STRATEGIES,
        JSON.stringify(testStrategies),
      );
      const strategies = loadPlayerStrategies();
      expect(strategies).toEqual(testStrategies);
    });

    it("should handle empty strategies array", () => {
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify([]));
      // JSON.parse("[]") returns an array despite the Record return type
      const result = loadPlayerStrategies() as
        | PlayerStrategyData
        | PlayerStrategy[];
      expect(result).toEqual([]);
    });

    it("should return null when stored value is null string", () => {
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, "null");
      const result = loadPlayerStrategies() as PlayerStrategyData | null;
      // JSON.parse("null") returns null, not an array
      expect(result).toEqual(null);
    });
  });

  describe("clearGameStateStorage", () => {
    it("removes the saved game, its seats included, but keeps the player name", () => {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SEATS, JSON.stringify({}));
      localStorage.setItem(STORAGE_KEYS.LLM_LOGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, "TestPlayer");

      clearGameStateStorage();

      expect(localStorage.getItem(STORAGE_KEYS.EVENTS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.SEATS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.LLM_LOGS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.STRATEGIES)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.PLAYER_NAME)).toBe("TestPlayer");
    });

    it("should be safe to call when storage is empty", () => {
      expect(() => clearGameStateStorage()).not.toThrow();
    });
  });

  describe("STORAGE_KEYS constant", () => {
    it("should have all required keys defined", () => {
      expect(STORAGE_KEYS.EVENTS).toBeDefined();
      expect(STORAGE_KEYS.SEATS).toBeDefined();
      expect(STORAGE_KEYS.LLM_LOGS).toBeDefined();
      expect(STORAGE_KEYS.STRATEGIES).toBeDefined();
      expect(STORAGE_KEYS.PLAYER_NAME).toBeDefined();
    });

    it("should have unique key values", () => {
      const keys = Object.values(STORAGE_KEYS);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });
});
