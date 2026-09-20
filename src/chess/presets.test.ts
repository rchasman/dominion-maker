import { describe, expect, it } from "bun:test";
import { CHESS_PLAYERS } from "./seat";
import { CHESS_SEAT_PRESETS, chessSeats } from "./presets";
import { chessModule } from "./module";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";

const STORED = { w: HUMAN_SEAT, b: HEURISTIC_SEAT };

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

  it("never hands a chess seat the Dominion roster", () => {
    const rosters = Object.values(CHESS_SEAT_PRESETS)
      .flatMap(preset => Object.values(preset.seats(CHESS_PLAYERS)))
      .flatMap(config => (config.kind === "llm" ? [config] : []));
    expect(rosters.length).toBeGreaterThan(0);
    expect(rosters.every(config => !config.models.includes("jev"))).toBe(true);
  });
});

describe("seating a chess table", () => {
  it("takes the chosen preset when the game starts fresh", () => {
    expect(chessSeats(false, STORED, "watch")).toEqual({
      w: chessModule.defaultLlmSeat,
      b: chessModule.defaultLlmSeat,
    });
  });

  it("keeps the table a restored game was played on", () => {
    expect(chessSeats(true, STORED, "watch")).toEqual(STORED);
  });

  it("ignores a stored table that belongs to another game", () => {
    expect(chessSeats(true, { human: HUMAN_SEAT }, "rules")).toEqual({
      w: HUMAN_SEAT,
      b: HEURISTIC_SEAT,
    });
  });
});
