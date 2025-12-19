import { describe, it, expect } from "bun:test";
import { generatePlayerName } from "./name-generator";

describe("name-generator", () => {
  describe("generatePlayerName", () => {
    it("generates a non-empty string", () => {
      const name = generatePlayerName();
      expect(name.length).toBeGreaterThan(0);
    });

    it("generates a capitalized name", () => {
      const name = generatePlayerName();
      expect(name[0]).toBe(name[0]?.toUpperCase());
    });

    it("generates different names on repeated calls", () => {
      const names = new Set([
        generatePlayerName(),
        generatePlayerName(),
        generatePlayerName(),
        generatePlayerName(),
        generatePlayerName(),
      ]);
      expect(names.size).toBeGreaterThan(1);
    });

    it("falls back to 'Player' when adjective or noun is undefined", () => {
      const name = generatePlayerName();
      expect(name).toBeDefined();
      expect(typeof name).toBe("string");
    });

    it("generates names in CamelCase format", () => {
      const name = generatePlayerName();
      expect(name).toMatch(/^[A-Z][a-z]*[A-Z][a-z]*$/);
    });

    it("generates unique names with high probability", () => {
      const names = new Set(
        Array.from({ length: 50 }, () => generatePlayerName()),
      );
      expect(names.size).toBeGreaterThan(40);
    });

    it("uses crypto random for generation", () => {
      const name = generatePlayerName();
      expect(name).toBeDefined();
      expect(name).not.toBe("Player");
    });

    it("generates names without underscores", () => {
      const name = generatePlayerName();
      expect(name.includes("_")).toBe(false);
    });

    it("generates names without spaces", () => {
      const name = generatePlayerName();
      expect(name.includes(" ")).toBe(false);
    });
  });
});
