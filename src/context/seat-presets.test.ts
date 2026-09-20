import { describe, it, expect } from "bun:test";
import { SEAT_PRESETS, SEAT_PRESET_NAMES } from "./seat-presets";
import { isHumanSeat } from "../core/seats";

describe("seat presets", () => {
  it("seats the first player as the human in rules and hybrid", () => {
    for (const name of ["rules", "hybrid"] as const) {
      const preset = SEAT_PRESETS[name];
      const players = preset.players();
      const seats = preset.seats(players);
      expect(isHumanSeat(seats[players[0] ?? ""])).toBe(true);
      expect(isHumanSeat(seats[players[1] ?? ""])).toBe(false);
    }
    expect(SEAT_PRESETS.rules.seats(["a", "b"])["b"]?.kind).toBe("heuristic");
    expect(SEAT_PRESETS.rules.name).toBe("Engine");
    expect(SEAT_PRESETS.watch.name).toBe("Full");
    expect(SEAT_PRESETS.hybrid.seats(["a", "b"])["b"]?.kind).toBe("llm");
  });

  it("seats two LLM players in watch mode with generated names", () => {
    const players = SEAT_PRESETS.watch.players();
    const seats = SEAT_PRESETS.watch.seats(players);
    expect(players).toHaveLength(2);
    expect(Object.values(seats).every(seat => seat.kind === "llm")).toBe(true);
  });

  it("lists every preset name", () => {
    expect(SEAT_PRESET_NAMES).toEqual(["rules", "hybrid", "watch"]);
  });
});

describe("presetOf", () => {
  it("recognises the three tables and rejects mixed ones", async () => {
    const { presetOf } = await import("./seat-presets");
    const { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } =
      await import("../core/seats");
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
