import { describe, it, expect } from "bun:test";
import {
  generateAINames,
  getAIName,
  isAIName,
  getAllAINames,
} from "./ai-names";

describe("AI name utilities", () => {
  describe("generateAINames", () => {
    it("should generate two AI names", () => {
      const [name1, name2] = generateAINames();

      expect(name1).toBeTruthy();
      expect(name2).toBeTruthy();
      expect(typeof name1).toBe("string");
      expect(typeof name2).toBe("string");
    });

    it("should generate unique names", () => {
      const [name1, name2] = generateAINames();
      expect(name1).not.toBe(name2);
    });

    it("should generate names from the AI_NAMES list", () => {
      const allNames = getAllAINames();
      const [name1, name2] = generateAINames();

      expect(allNames).toContain(name1);
      expect(allNames).toContain(name2);
    });

    it("should generate different names on subsequent calls", () => {
      const pairs: string[] = [];

      // Generate 10 pairs
      for (let i = 0; i < 10; i++) {
        const [name1, name2] = generateAINames();
        pairs.push(`${name1}-${name2}`);
      }

      // At least some should be different (random)
      const uniquePairs = new Set(pairs);
      expect(uniquePairs.size).toBeGreaterThan(1);
    });
  });

  describe("getAIName", () => {
    it("should return deterministic names by index", () => {
      const name0 = getAIName(0);
      const name1 = getAIName(1);

      expect(name0).toBeTruthy();
      expect(name1).toBeTruthy();
    });

    it("should return same name for same index", () => {
      expect(getAIName(5)).toBe(getAIName(5));
      expect(getAIName(10)).toBe(getAIName(10));
    });

    it("should wrap around using modulo", () => {
      const allNames = getAllAINames();
      const length = allNames.length;

      expect(getAIName(0)).toBe(getAIName(length));
      expect(getAIName(5)).toBe(getAIName(length + 5));
    });
  });

  describe("isAIName", () => {
    it("should return true for valid AI names", () => {
      expect(isAIName("Alpha")).toBe(true);
      expect(isAIName("Nova")).toBe(true);
      expect(isAIName("Nexus")).toBe(true);
      expect(isAIName("Cipher")).toBe(true);
    });

    it("should return false for non-AI names", () => {
      expect(isAIName("human")).toBe(false);
      expect(isAIName("ai")).toBe(false);
      expect(isAIName("ai1")).toBe(false);
      expect(isAIName("ai2")).toBe(false);
      expect(isAIName("player")).toBe(false);
      expect(isAIName("player1")).toBe(false);
    });

    it("should return false for random strings", () => {
      expect(isAIName("RandomName")).toBe(false);
      expect(isAIName("xyz")).toBe(false);
      expect(isAIName("123")).toBe(false);
      expect(isAIName("")).toBe(false);
    });

    it("should be case sensitive", () => {
      expect(isAIName("alpha")).toBe(false); // lowercase
      expect(isAIName("Alpha")).toBe(true); // uppercase
      expect(isAIName("ALPHA")).toBe(false); // all caps
    });
  });

  describe("getAllAINames", () => {
    it("should return an array of names", () => {
      const names = getAllAINames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it("should return readonly array", () => {
      const names = getAllAINames();
      expect(Object.isFrozen(names) || names === getAllAINames()).toBe(true);
    });

    it("should contain expected categories of names", () => {
      const names = getAllAINames();
      const nameStr = names.join(",");

      // Greek letters
      expect(nameStr).toContain("Alpha");
      expect(nameStr).toContain("Omega");

      // Sci-fi
      expect(nameStr).toContain("Nova");
      expect(nameStr).toContain("Nexus");

      // Mythological
      expect(nameStr).toContain("Atlas");
      expect(nameStr).toContain("Zeus");

      // Tech
      expect(nameStr).toContain("Cortex");
      expect(nameStr).toContain("Binary");

      // Abstract
      expect(nameStr).toContain("Zenith");
      expect(nameStr).toContain("Paradox");
    });

    it("should have at least 40 names for variety", () => {
      const names = getAllAINames();
      expect(names.length).toBeGreaterThanOrEqual(40);
    });
  });
});
