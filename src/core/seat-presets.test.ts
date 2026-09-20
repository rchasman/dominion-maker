import { describe, it, expect } from "bun:test";
import { SEAT_PRESET_NAMES, presetOf, versus } from "./seat-presets";
import {
  DEFAULT_LLM_SEAT,
  HEURISTIC_SEAT,
  HUMAN_SEAT,
  isHumanSeat,
} from "./seats";

describe("versus", () => {
  it("seats the first player as the human and the rest as the opponent", () => {
    const seats = versus(HEURISTIC_SEAT)(["a", "b", "c"]);
    expect(isHumanSeat(seats["a"])).toBe(true);
    expect(seats["b"]?.kind).toBe("heuristic");
    expect(seats["c"]?.kind).toBe("heuristic");
  });
});

describe("seat preset names", () => {
  it("lists every preset name", () => {
    expect(SEAT_PRESET_NAMES).toEqual(["rules", "hybrid", "watch"]);
  });
});

describe("presetOf", () => {
  it("recognises the three tables and rejects mixed ones", () => {
    expect(presetOf({ a: HUMAN_SEAT, b: HEURISTIC_SEAT })).toBe("rules");
    expect(presetOf({ a: HUMAN_SEAT, b: DEFAULT_LLM_SEAT })).toBe("hybrid");
    expect(presetOf({ a: DEFAULT_LLM_SEAT, b: DEFAULT_LLM_SEAT })).toBe(
      "watch",
    );
    expect(presetOf({ a: HUMAN_SEAT, b: HUMAN_SEAT })).toBeNull();
    expect(presetOf({ a: HEURISTIC_SEAT, b: DEFAULT_LLM_SEAT })).toBeNull();
    expect(presetOf({})).toBeNull();
  });
});
