import { describe, it, expect } from "bun:test";
import {
  getCardNamesFromMetadata,
  getStringArrayFromMetadata,
  getNumberFromMetadata,
  getStringFromMetadata,
} from "./metadata-helpers";
import type { CardName } from "../types/game-state";

describe("metadata-helpers", () => {
  describe("getCardNamesFromMetadata", () => {
    it("returns CardName array when key exists", () => {
      const metadata = {
        cards: ["Copper", "Silver", "Gold"],
      };
      const result = getCardNamesFromMetadata(metadata, "cards");
      expect(result).toEqual(["Copper", "Silver", "Gold"]);
    });

    it("returns empty array when key does not exist", () => {
      const metadata = {};
      const result = getCardNamesFromMetadata(metadata, "cards");
      expect(result).toEqual([]);
    });

    it("returns empty array when value is not an array", () => {
      const metadata = {
        cards: "Copper",
      };
      const result = getCardNamesFromMetadata(metadata, "cards");
      expect(result).toEqual([]);
    });

    it("returns empty array when value is null", () => {
      const metadata = {
        cards: null,
      };
      const result = getCardNamesFromMetadata(metadata, "cards");
      expect(result).toEqual([]);
    });

    it("returns empty array when value is undefined", () => {
      const metadata = {
        cards: undefined,
      };
      const result = getCardNamesFromMetadata(metadata, "cards");
      expect(result).toEqual([]);
    });

    it("handles undefined metadata", () => {
      const result = getCardNamesFromMetadata(undefined, "cards");
      expect(result).toEqual([]);
    });

    it("handles empty array", () => {
      const metadata = {
        cards: [],
      };
      const result = getCardNamesFromMetadata(metadata, "cards");
      expect(result).toEqual([]);
    });
  });

  describe("getStringArrayFromMetadata", () => {
    it("returns string array when key exists", () => {
      const metadata = {
        options: ["option1", "option2", "option3"],
      };
      const result = getStringArrayFromMetadata(metadata, "options");
      expect(result).toEqual(["option1", "option2", "option3"]);
    });

    it("returns empty array when key does not exist", () => {
      const metadata = {};
      const result = getStringArrayFromMetadata(metadata, "options");
      expect(result).toEqual([]);
    });

    it("returns empty array when value is not an array", () => {
      const metadata = {
        options: "single",
      };
      const result = getStringArrayFromMetadata(metadata, "options");
      expect(result).toEqual([]);
    });

    it("returns empty array when value is null", () => {
      const metadata = {
        options: null,
      };
      const result = getStringArrayFromMetadata(metadata, "options");
      expect(result).toEqual([]);
    });

    it("handles undefined metadata", () => {
      const result = getStringArrayFromMetadata(undefined, "options");
      expect(result).toEqual([]);
    });

    it("handles empty array", () => {
      const metadata = {
        options: [],
      };
      const result = getStringArrayFromMetadata(metadata, "options");
      expect(result).toEqual([]);
    });
  });

  describe("getNumberFromMetadata", () => {
    it("returns number when key exists", () => {
      const metadata = {
        count: 5,
      };
      const result = getNumberFromMetadata(metadata, "count");
      expect(result).toBe(5);
    });

    it("returns default value (0) when key does not exist", () => {
      const metadata = {};
      const result = getNumberFromMetadata(metadata, "count");
      expect(result).toBe(0);
    });

    it("returns custom default value when key does not exist", () => {
      const metadata = {};
      const result = getNumberFromMetadata(metadata, "count", 10);
      expect(result).toBe(10);
    });

    it("returns default value when value is not a number", () => {
      const metadata = {
        count: "5",
      };
      const result = getNumberFromMetadata(metadata, "count");
      expect(result).toBe(0);
    });

    it("returns default value when value is null", () => {
      const metadata = {
        count: null,
      };
      const result = getNumberFromMetadata(metadata, "count", 7);
      expect(result).toBe(7);
    });

    it("handles undefined metadata", () => {
      const result = getNumberFromMetadata(undefined, "count");
      expect(result).toBe(0);
    });

    it("handles zero as valid number", () => {
      const metadata = {
        count: 0,
      };
      const result = getNumberFromMetadata(metadata, "count");
      expect(result).toBe(0);
    });

    it("handles negative numbers", () => {
      const metadata = {
        count: -5,
      };
      const result = getNumberFromMetadata(metadata, "count");
      expect(result).toBe(-5);
    });
  });

  describe("getStringFromMetadata", () => {
    it("returns string when key exists", () => {
      const metadata = {
        message: "hello",
      };
      const result = getStringFromMetadata(metadata, "message");
      expect(result).toBe("hello");
    });

    it("returns default value (empty string) when key does not exist", () => {
      const metadata = {};
      const result = getStringFromMetadata(metadata, "message");
      expect(result).toBe("");
    });

    it("returns custom default value when key does not exist", () => {
      const metadata = {};
      const result = getStringFromMetadata(metadata, "message", "default");
      expect(result).toBe("default");
    });

    it("returns default value when value is not a string", () => {
      const metadata = {
        message: 123,
      };
      const result = getStringFromMetadata(metadata, "message");
      expect(result).toBe("");
    });

    it("returns default value when value is null", () => {
      const metadata = {
        message: null,
      };
      const result = getStringFromMetadata(metadata, "message", "fallback");
      expect(result).toBe("fallback");
    });

    it("handles undefined metadata", () => {
      const result = getStringFromMetadata(undefined, "message");
      expect(result).toBe("");
    });

    it("handles empty string as valid value", () => {
      const metadata = {
        message: "",
      };
      const result = getStringFromMetadata(metadata, "message");
      expect(result).toBe("");
    });
  });
});
