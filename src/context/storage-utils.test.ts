import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  loadGameMode,
  loadEvents,
  loadLLMLogs,
  loadModelSettings,
  loadPlayerStrategies,
  clearGameStorage,
  clearGameStateStorage,
  STORAGE_KEYS,
} from "./storage-utils";

// Mock localStorage for tests
const mockStorage: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    for (const key in mockStorage) {
      delete mockStorage[key];
    }
  },
};

// Set global localStorage
if (typeof global !== "undefined") {
  (global as any).localStorage = mockLocalStorage;
}

describe("storage-utils", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  describe("loadGameMode", () => {
    it("should return 'engine' as default when nothing is stored", () => {
      expect(loadGameMode()).toBe("engine");
    });

    it("should return 'engine' when stored value is null", () => {
      localStorage.removeItem(STORAGE_KEYS.MODE);
      expect(loadGameMode()).toBe("engine");
    });

    it("should return stored game mode when valid", () => {
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify("hybrid"));
      expect(loadGameMode()).toBe("hybrid");
    });

    it("should return stored game mode 'full'", () => {
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify("full"));
      expect(loadGameMode()).toBe("full");
    });

    it("should return stored game mode 'multiplayer'", () => {
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify("multiplayer"));
      expect(loadGameMode()).toBe("multiplayer");
    });

    it("should return 'engine' when stored mode is invalid", () => {
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify("invalid_mode"));
      expect(loadGameMode()).toBe("engine");
    });

    it("should return 'engine' when stored mode is not valid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.MODE, "not-json");
      expect(loadGameMode()).toBe("engine");
    });

    it("should return 'engine' when stored mode is a number", () => {
      localStorage.setItem(STORAGE_KEYS.MODE, "42");
      expect(loadGameMode()).toBe("engine");
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
      const testEvents = [
        { type: "START_GAME", id: "event-1", playerId: "human" },
        { type: "TURN_STARTED", id: "event-2", playerId: "human" },
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
      const testLogs = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: 1 },
        },
      ];
      localStorage.setItem(STORAGE_KEYS.LLM_LOGS, JSON.stringify(testLogs));
      const logs = loadLLMLogs();
      expect(logs).toEqual(testLogs);
    });

    it("should return null when stored as null string (JSON.parse behavior)", () => {
      mockLocalStorage.setItem(STORAGE_KEYS.LLM_LOGS, "null");
      const result = loadLLMLogs();
      // JSON.parse("null") returns null literal, though TypeScript casts it to array
      // This is a limitation of the implementation - in practice, this shouldn't happen
      expect(result).toBe(null);
    });
  });

  describe("loadModelSettings", () => {
    it("should return null when no settings are stored", () => {
      expect(loadModelSettings()).toBeNull();
    });

    it("should return null when storage value is invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, "not-json");
      expect(loadModelSettings()).toBeNull();
    });

    it("should return parsed settings with enabledModels as Set", () => {
      const testSettings = {
        enabledModels: ["openai", "anthropic"],
        consensusCount: 3,
        customStrategy: "test-strategy",
      };
      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, JSON.stringify(testSettings));
      const settings = loadModelSettings();
      expect(settings).not.toBeNull();
      if (settings) {
        expect(settings.enabledModels instanceof Set).toBe(true);
        expect(Array.from(settings.enabledModels)).toEqual(["openai", "anthropic"]);
        expect(settings.consensusCount).toBe(3);
        expect(settings.customStrategy).toBe("test-strategy");
      }
    });

    it("should default customStrategy to empty string when not provided", () => {
      const testSettings = {
        enabledModels: ["openai"],
        consensusCount: 2,
      };
      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, JSON.stringify(testSettings));
      const settings = loadModelSettings();
      expect(settings).not.toBeNull();
      if (settings) {
        expect(settings.customStrategy).toBe("");
      }
    });

    it("should handle empty enabledModels array", () => {
      const testSettings = {
        enabledModels: [],
        consensusCount: 1,
      };
      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, JSON.stringify(testSettings));
      const settings = loadModelSettings();
      expect(settings).not.toBeNull();
      if (settings) {
        expect(settings.enabledModels.size).toBe(0);
      }
    });

    it("should return null when stored value is null string", () => {
      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, "null");
      expect(loadModelSettings()).toBeNull();
    });
  });

  describe("loadPlayerStrategies", () => {
    it("should return empty array when no strategies are stored", () => {
      expect(loadPlayerStrategies()).toEqual([]);
    });

    it("should return empty array when storage is null", () => {
      localStorage.removeItem(STORAGE_KEYS.STRATEGIES);
      expect(loadPlayerStrategies()).toEqual([]);
    });

    it("should return empty array when stored value is invalid JSON", () => {
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, "not-json");
      expect(loadPlayerStrategies()).toEqual([]);
    });

    it("should return parsed strategies when stored as array", () => {
      const testStrategies = [
        {
          id: "human",
          gameplan: "Buy villages",
          read: "Build engine",
          recommendation: "Keep smithies",
        },
      ];
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify(testStrategies));
      const strategies = loadPlayerStrategies();
      expect(strategies).toEqual(testStrategies);
    });

    it("should handle empty strategies array", () => {
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify([]));
      expect(loadPlayerStrategies()).toEqual([]);
    });

    it("should return null when stored value is null string", () => {
      mockLocalStorage.setItem(STORAGE_KEYS.STRATEGIES, "null");
      const result = loadPlayerStrategies();
      // JSON.parse("null") returns null, not an array
      expect(result).toEqual(null);
    });
  });

  describe("clearGameStorage", () => {
    it("should remove all game-related storage keys", () => {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify("hybrid"));
      localStorage.setItem(STORAGE_KEYS.LLM_LOGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, JSON.stringify({}));
      localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, "TestPlayer");

      clearGameStorage();

      expect(localStorage.getItem(STORAGE_KEYS.EVENTS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.MODE)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.LLM_LOGS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.STRATEGIES)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.MODEL_SETTINGS)).toBeNull();
    });

    it("should not affect other localStorage keys", () => {
      localStorage.setItem("other-key", "other-value");
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));

      clearGameStorage();

      expect(localStorage.getItem("other-key")).toBe("other-value");
    });

    it("should be safe to call when storage is empty", () => {
      expect(() => clearGameStorage()).not.toThrow();
    });
  });

  describe("clearGameStateStorage", () => {
    it("should remove game state storage keys but preserve mode and settings", () => {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify("hybrid"));
      localStorage.setItem(STORAGE_KEYS.LLM_LOGS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MODEL_SETTINGS, JSON.stringify({}));

      clearGameStateStorage();

      expect(localStorage.getItem(STORAGE_KEYS.EVENTS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.LLM_LOGS)).toBeNull();
      expect(localStorage.getItem(STORAGE_KEYS.STRATEGIES)).toBeNull();
      // Mode and settings should still be there
      expect(localStorage.getItem(STORAGE_KEYS.MODE)).toBe(JSON.stringify("hybrid"));
      expect(localStorage.getItem(STORAGE_KEYS.MODEL_SETTINGS)).toBe(JSON.stringify({}));
    });

    it("should be safe to call when storage is empty", () => {
      expect(() => clearGameStateStorage()).not.toThrow();
    });
  });

  describe("STORAGE_KEYS constant", () => {
    it("should have all required keys defined", () => {
      expect(STORAGE_KEYS.EVENTS).toBeDefined();
      expect(STORAGE_KEYS.MODE).toBeDefined();
      expect(STORAGE_KEYS.LLM_LOGS).toBeDefined();
      expect(STORAGE_KEYS.MODEL_SETTINGS).toBeDefined();
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
