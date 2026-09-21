import { describe, expect, it } from "bun:test";
import type { GoMoveRecord } from "../shape";
import { gameStats } from "./game-stats";

const SIZE = 9;

const point = (x: number, y: number): GoMoveRecord => ({ x, y });

/** Black lays `stones` while White answers each with a pass after its one stone, then both pass */
const blackStonesThenPasses = (stones: number): GoMoveRecord[] => [
  ...Array.from({ length: stones }, (_, index) =>
    index === 0
      ? [point(index, 0), point(8, 8)]
      : [point(index, 0), "pass" as const],
  ).flat(),
  "pass",
];

describe("gameStats", () => {
  it("does not count a pass that ends the game won as premature", () => {
    // Nine Black stones against one White stone and komi: Black leads 9 to 8.5
    // with every empty point neutral, and White has just passed
    const stats = gameStats(SIZE, blackStonesThenPasses(9), "B");
    expect(stats.passes).toBe(1);
    expect(stats.prematurePasses).toBe(0);
  });

  it("counts a pass made while behind with neutral points left as premature", () => {
    // Three Black stones against one White stone and komi: Black trails 3 to 8.5
    const stats = gameStats(SIZE, blackStonesThenPasses(3), "B");
    expect(stats.passes).toBe(1);
    expect(stats.prematurePasses).toBe(1);
  });

  it("counts the first-line, self-atari and eye-fill moves of one colour", () => {
    // Black's A8 sits between White's A7 and B8 with A9 as its one liberty
    const stats = gameStats(
      SIZE,
      [point(4, 4), point(0, 2), point(5, 4), point(1, 1), point(0, 1)],
      "B",
    );
    expect(stats).toEqual({
      firstLine: 1,
      quietFirstLine: 1,
      selfAtari: 1,
      eyeFills: 0,
      passes: 0,
      prematurePasses: 0,
    });
  });
});
