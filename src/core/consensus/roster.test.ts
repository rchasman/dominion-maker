import { describe, it, expect } from "bun:test";
import { buildRoster } from "./roster";
import { DEFAULT_LLM_SEAT } from "../seats";

const seat = (
  models: typeof DEFAULT_LLM_SEAT.models,
  consensusCount: number,
) => ({ ...DEFAULT_LLM_SEAT, models, consensusCount });

describe("buildRoster", () => {
  it("falls back to a fast default roster when nothing is enabled", () => {
    const roster = buildRoster(seat([], 12));
    expect(roster.length).toBeGreaterThan(0);
    expect(new Set(roster).size).toBeGreaterThan(1);
  });
  it("cycles enabled models to reach the count", () => {
    const roster = buildRoster(seat(["gpt-4.1-mini-fast", "grok-4-fast"], 6));
    expect(roster).toHaveLength(6);
    expect(roster.filter(m => m === "gpt-4.1-mini-fast")).toHaveLength(3);
    expect(roster.filter(m => m === "grok-4-fast")).toHaveLength(3);
  });
  it("respects per-model instance limits", () => {
    const roster = buildRoster(seat(["gpt-5.5", "gpt-4.1-mini-fast"], 10));
    expect(roster).toHaveLength(10);
    expect(roster.filter(m => m === "gpt-5.5").length).toBeLessThanOrEqual(3);
  });
  it("builds from a seat config and deduplicates the enabled list", () => {
    const roster = buildRoster({
      ...DEFAULT_LLM_SEAT,
      models: ["jev", "jev"],
      consensusCount: 2,
    });
    expect(roster).toEqual(["jev", "jev"]);
  });
});
