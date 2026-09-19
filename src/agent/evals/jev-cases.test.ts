import { describe, it, expect } from "bun:test";
import { jevCases } from "./jev-cases";
import { getLegalActions } from "../legal-actions";
import { stripReasoning } from "../../types/action";

describe("jevCases", () => {
  it("every acceptable action is legal in its scenario, so a miss is Jev's and not the case's", () => {
    for (const scenario of jevCases()) {
      const legal = getLegalActions(scenario.state).map(a =>
        JSON.stringify(stripReasoning(a)),
      );
      expect(legal.length).toBeGreaterThan(1);
      for (const action of scenario.acceptable) {
        expect(legal).toContain(JSON.stringify(stripReasoning(action)));
      }
    }
  });

  it("has unique ids", () => {
    const ids = jevCases().map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
