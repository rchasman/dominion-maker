import { describe, it, expect } from "bun:test";
import { TIMING, MIN_TURN_FOR_STRATEGY } from "./game-constants";

describe("game-constants", () => {
  describe("TIMING constants", () => {
    it("defines the delay between driver steps", () => {
      expect(TIMING.AI_STEP_DELAY).toBeGreaterThan(0);
      expect(TIMING.AI_STEP_DELAY).toBeLessThan(5000);
    });

    it("defines the auto-advance delay below the step delay", () => {
      expect(TIMING.AUTO_ADVANCE_DELAY).toBeGreaterThan(0);
      expect(TIMING.AUTO_ADVANCE_DELAY).toBeLessThan(TIMING.AI_STEP_DELAY);
    });
  });

  describe("MIN_TURN_FOR_STRATEGY constant", () => {
    it("should be 1 to allow strategy analysis from turn 1", () => {
      expect(MIN_TURN_FOR_STRATEGY).toBe(1);
    });
  });
});
