import { describe, expect, it } from "bun:test";
import { createGame } from "../engine";
import { buildStrategicContext } from "./strategic-context";
import {
  buildStrategyAnalysisMessage,
  PlayerAnalysisSchema,
} from "./strategy-analysis";
import { choiceSchema, choiceToAction } from "./choice-parsing";
import { analysisVersion } from "./analysis-version";

const commentary = {
  gameplan: "Use Witch to trash Gold",
  read: "Witch trashes Silver and Curse",
  recommendation: "Keep trashing enemy treasures",
};
const decisionPlan = {
  priority: "Build buying power",
  conditions: ["Add economy when actions already compete"],
};

describe("strategy grounding boundaries", () => {
  it("keeps display commentary out of both player and analyst prompts", () => {
    const state = createGame(["ai", "human"], undefined, 42).state;
    const analysis = { ...commentary, decisionPlan };
    const context = buildStrategicContext(
      state,
      JSON.stringify({ ai: analysis }),
    );
    const analyst = buildStrategyAnalysisMessage(state, "ai", analysis);
    for (const prompt of [context, analyst]) {
      expect(prompt).toContain("Build buying power");
      for (const text of Object.values(commentary))
        expect(prompt).not.toContain(text);
    }
  });

  it("drops legacy commentary instead of laundering it into a plan", () => {
    const state = createGame(["ai", "human"], undefined, 42).state;
    const context = buildStrategicContext(
      state,
      JSON.stringify({ ai: commentary }),
    );
    expect(context).toContain("No analysis yet");
    expect(context).not.toContain("Witch");
    expect(buildStrategyAnalysisMessage(state, "ai", commentary)).not.toContain(
      "PREVIOUS PLAN",
    );
  });

  it("rejects malformed plans and plans from another game", () => {
    const state = createGame(["ai", "human"], undefined, 42).state;
    const invalid = {
      ...commentary,
      decisionPlan: { priority: "Witch", conditions: [] },
    };
    expect(
      buildStrategicContext(state, JSON.stringify({ ai: invalid })),
    ).toContain("No analysis yet");
    const other = createGame(["ai", "human"], undefined, 43).state;
    const obsolete = {
      ...commentary,
      decisionPlan,
      analysis: analysisVersion(other),
    };
    expect(buildStrategyAnalysisMessage(state, "ai", obsolete)).not.toContain(
      "Build buying power",
    );
  });

  it("requires a bounded conditional plan from the analyst", () => {
    expect(PlayerAnalysisSchema.safeParse(commentary).success).toBe(false);
    expect(
      PlayerAnalysisSchema.safeParse({ ...commentary, decisionPlan }).success,
    ).toBe(true);
    expect(
      PlayerAnalysisSchema.safeParse({
        ...commentary,
        decisionPlan: { ...decisionPlan, priority: "x".repeat(241) },
      }).success,
    ).toBe(false);
  });

  it("treats legality as distinct from factual accuracy", () => {
    const legal = [{ type: "buy_card" as const, card: "Gold" as const }];
    const reply = choiceSchema(1).parse({
      reasoning: "Witch trashes Gold",
      choice: 1,
    });
    expect(choiceToAction(reply, legal)).toMatchObject({ card: "Gold" });
    // This schema does not claim to fact-check prose. Live evals grade that separately.
    expect(reply.reasoning).toBe("Witch trashes Gold");
  });
});
