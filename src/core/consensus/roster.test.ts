import { describe, it, expect } from "bun:test";
import { ALL_FAST_MODELS, buildRoster, buildRosterFrom } from "./roster";
import { DEFAULT_LLM_SEAT } from "../seats";

describe("buildRosterFrom", () => {
  it("returns the fast defaults when nothing is enabled", () => {
    expect(buildRosterFrom([], 12)).toEqual(ALL_FAST_MODELS);
  });
  it("cycles enabled models to reach the count", () => {
    const roster = buildRosterFrom(["gpt-5.4-mini", "grok-4-fast"], 6);
    expect(roster).toHaveLength(6);
    expect(roster.filter(m => m === "gpt-5.4-mini")).toHaveLength(3);
    expect(roster.filter(m => m === "grok-4-fast")).toHaveLength(3);
  });
  it("respects per-model instance limits", () => {
    const roster = buildRosterFrom(["gpt-5.4", "gpt-5.4-mini"], 10);
    expect(roster).toHaveLength(10);
    expect(roster.filter(m => m === "gpt-5.4").length).toBeLessThanOrEqual(3);
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
