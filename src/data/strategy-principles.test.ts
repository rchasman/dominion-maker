import { describe, it, expect } from "bun:test";
import { STRATEGY_PRINCIPLES } from "./strategy-principles";
import { CARDS } from "./cards";

describe("STRATEGY_PRINCIPLES", () => {
  it("names no card, so the doctrine holds in any kingdom or expansion", () => {
    const names = Object.keys(CARDS);
    for (const line of STRATEGY_PRINCIPLES) {
      for (const name of names) {
        expect(line.includes(name)).toBe(false);
      }
    }
  });

  it("carries no numeric thresholds", () => {
    for (const line of STRATEGY_PRINCIPLES) {
      expect(/\d/.test(line)).toBe(false);
    }
  });
});
