import { describe, expect, it } from "bun:test";
import { CHESS_PLAYERS } from "./seat";
import { CHESS_SEAT_PRESETS } from "./presets";
import { chessModule } from "./module";
import { DEFAULT_LLM_SEAT } from "../core/seats";

const kindsOf = (preset: keyof typeof CHESS_SEAT_PRESETS) =>
  CHESS_PLAYERS.map(id => CHESS_SEAT_PRESETS[preset].seats(CHESS_PLAYERS)[id]);

describe("the chess seat presets", () => {
  it("seats White for a human against the rules bot", () => {
    expect(kindsOf("rules")).toEqual([
      { kind: "human" },
      { kind: "heuristic" },
    ]);
  });

  it("seats White for a human against the chess LLM roster", () => {
    expect(kindsOf("hybrid")).toEqual([
      { kind: "human" },
      chessModule.defaultLlmSeat,
    ]);
  });

  it("seats both colours for the chess LLM roster to watch", () => {
    expect(kindsOf("watch")).toEqual([
      chessModule.defaultLlmSeat,
      chessModule.defaultLlmSeat,
    ]);
  });

  it("hands every LLM seat the default roster, Jev included", () => {
    const rosters = Object.values(CHESS_SEAT_PRESETS)
      .flatMap(preset => Object.values(preset.seats(CHESS_PLAYERS)))
      .flatMap(config => (config.kind === "llm" ? [config] : []));
    expect(rosters.length).toBeGreaterThan(0);
    expect(rosters.every(config => config === DEFAULT_LLM_SEAT)).toBe(true);
    expect(rosters.every(config => config.models.includes("jev"))).toBe(true);
  });
});
