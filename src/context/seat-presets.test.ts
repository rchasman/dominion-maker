import { describe, it, expect } from "bun:test";
import { SEAT_PRESETS } from "./seat-presets";
import { SEAT_PRESET_NAMES } from "../core/seat-presets";
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

  // The switcher walks the shared name list, so a table that drifts from it
  // would quietly hide a preset the sidebar is meant to offer
  it("offers exactly the presets the shared name list names", () => {
    expect(Object.keys(SEAT_PRESETS)).toEqual([...SEAT_PRESET_NAMES]);
  });
});
