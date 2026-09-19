import { describe, it, expect } from "bun:test";
import {
  firstHumanSeat,
  isHumanSeat,
  sameConfig,
  DEFAULT_LLM_SEAT,
} from "./seats";

describe("seats", () => {
  it("treats a missing seat as human", () => {
    expect(isHumanSeat(undefined)).toBe(true);
    expect(firstHumanSeat({ a: DEFAULT_LLM_SEAT }, ["a", "b"])).toBe("b");
  });

  it("finds the first human seat in player order", () => {
    expect(
      firstHumanSeat({ a: { kind: "heuristic" }, b: { kind: "human" } }, [
        "a",
        "b",
      ]),
    ).toBe("b");
    expect(
      firstHumanSeat({ a: DEFAULT_LLM_SEAT, b: DEFAULT_LLM_SEAT }, ["a", "b"]),
    ).toBeNull();
  });

  it("compares configs structurally", () => {
    expect(sameConfig(DEFAULT_LLM_SEAT, { ...DEFAULT_LLM_SEAT })).toBe(true);
    expect(
      sameConfig(DEFAULT_LLM_SEAT, { ...DEFAULT_LLM_SEAT, consensusCount: 3 }),
    ).toBe(false);
    expect(sameConfig(undefined, { kind: "human" })).toBe(true);
  });
});
