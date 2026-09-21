import { describe, expect, it } from "bun:test";
import { GO_PLAYERS } from "./seat";
import { GO_SEAT_PRESETS } from "./presets";
import { goModule } from "./module";

const kindsOf = (preset: keyof typeof GO_SEAT_PRESETS) =>
  GO_PLAYERS.map(id => GO_SEAT_PRESETS[preset].seats(GO_PLAYERS)[id]);

describe("the Go seat presets", () => {
  it("seats Black for a human against the rules bot", () => {
    expect(kindsOf("rules")).toEqual([
      { kind: "human" },
      { kind: "heuristic" },
    ]);
  });

  it("seats Black for a human against the Go LLM roster", () => {
    expect(kindsOf("hybrid")).toEqual([
      { kind: "human" },
      goModule.defaultLlmSeat,
    ]);
  });

  it("seats both colours for the Go LLM roster to watch", () => {
    expect(kindsOf("watch")).toEqual([
      goModule.defaultLlmSeat,
      goModule.defaultLlmSeat,
    ]);
  });

  it("never hands a Go seat the Dominion roster", () => {
    const rosters = Object.values(GO_SEAT_PRESETS)
      .flatMap(preset => Object.values(preset.seats(GO_PLAYERS)))
      .flatMap(config => (config.kind === "llm" ? [config] : []));
    expect(rosters.length).toBeGreaterThan(0);
    expect(rosters.every(config => !config.models.includes("jev"))).toBe(true);
  });
});
