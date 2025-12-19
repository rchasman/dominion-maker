import { describe, it, expect } from "bun:test";
import { TIMING, MIN_TURN_FOR_STRATEGY } from "./game-constants";

describe("game-constants", () => {
  describe("TIMING constants", () => {
    it("should define AI_TURN_DELAY", () => {
      expect(TIMING.AI_TURN_DELAY).toBeDefined();
      expect(typeof TIMING.AI_TURN_DELAY).toBe("number");
      expect(TIMING.AI_TURN_DELAY).toBeGreaterThan(0);
    });

    it("should define AI_DECISION_DELAY", () => {
      expect(TIMING.AI_DECISION_DELAY).toBeDefined();
      expect(typeof TIMING.AI_DECISION_DELAY).toBe("number");
      expect(TIMING.AI_DECISION_DELAY).toBeGreaterThan(0);
    });

    it("should define AUTO_ADVANCE_DELAY", () => {
      expect(TIMING.AUTO_ADVANCE_DELAY).toBeDefined();
      expect(typeof TIMING.AUTO_ADVANCE_DELAY).toBe("number");
      expect(TIMING.AUTO_ADVANCE_DELAY).toBeGreaterThan(0);
    });

    it("should have reasonable delay values", () => {
      expect(TIMING.AI_TURN_DELAY).toBeLessThan(5000);
      expect(TIMING.AI_DECISION_DELAY).toBeLessThan(5000);
      expect(TIMING.AUTO_ADVANCE_DELAY).toBeLessThan(5000);
    });

    it("should be a constant object", () => {
      expect(TIMING).toBeDefined();
      expect(typeof TIMING).toBe("object");
    });

    it("AI_TURN_DELAY and AI_DECISION_DELAY should be equal", () => {
      expect(TIMING.AI_TURN_DELAY).toBe(TIMING.AI_DECISION_DELAY);
    });

    it("AUTO_ADVANCE_DELAY should be smaller than AI delays", () => {
      expect(TIMING.AUTO_ADVANCE_DELAY).toBeLessThan(TIMING.AI_TURN_DELAY);
    });
  });

  describe("MIN_TURN_FOR_STRATEGY constant", () => {
    it("should be defined", () => {
      expect(MIN_TURN_FOR_STRATEGY).toBeDefined();
    });

    it("should be a non-negative number", () => {
      expect(typeof MIN_TURN_FOR_STRATEGY).toBe("number");
      expect(MIN_TURN_FOR_STRATEGY).toBeGreaterThanOrEqual(0);
    });

    it("should be 1 to allow strategy analysis from turn 1", () => {
      expect(MIN_TURN_FOR_STRATEGY).toBe(1);
    });
  });
});
