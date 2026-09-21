import { describe, it, expect } from "bun:test";
import {
  SEAT_PRESET_NAMES,
  presetOf,
  seatsFor,
  twoColourPresets,
  versus,
} from "./seat-presets";
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

describe("twoColourPresets", () => {
  const presets = twoColourPresets("Red", DEFAULT_LLM_SEAT);
  const players = ["r", "k"];

  it("names the human's colour and seats it first against the chosen roster", () => {
    expect(presets.rules.description).toBe("Play Red against the rules bot");
    expect(presets.rules.seats(players)).toEqual({
      r: HUMAN_SEAT,
      k: HEURISTIC_SEAT,
    });
    expect(presets.hybrid.seats(players)).toEqual({
      r: HUMAN_SEAT,
      k: DEFAULT_LLM_SEAT,
    });
    expect(presets.watch.seats(players)).toEqual({
      r: DEFAULT_LLM_SEAT,
      k: DEFAULT_LLM_SEAT,
    });
    expect(Object.values(presets).map(preset => preset.name)).toEqual([
      "Engine",
      "Hybrid",
      "Full",
    ]);
  });
});

describe("seatsFor", () => {
  const presets = twoColourPresets("White", DEFAULT_LLM_SEAT);
  const players = ["w", "b"];
  const saved = { w: HUMAN_SEAT, b: HEURISTIC_SEAT };

  it("takes the chosen preset when the game starts fresh", () => {
    expect(
      seatsFor({ presets, players, restored: false, saved, preset: "watch" }),
    ).toEqual({ w: DEFAULT_LLM_SEAT, b: DEFAULT_LLM_SEAT });
  });

  it("keeps the table a restored game was played on", () => {
    expect(
      seatsFor({ presets, players, restored: true, saved, preset: "watch" }),
    ).toEqual(saved);
  });

  it("ignores a stored table that belongs to another game", () => {
    expect(
      seatsFor({
        presets,
        players,
        restored: true,
        saved: { human: HUMAN_SEAT },
        preset: "rules",
      }),
    ).toEqual({ w: HUMAN_SEAT, b: HEURISTIC_SEAT });
  });
});
