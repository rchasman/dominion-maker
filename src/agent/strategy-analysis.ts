import { buildPublicPlayerSummaries } from "./state-projection";
import { encodeToon } from "../lib/toon";
import {
  formatTurnHistoryForAnalysis,
  STRATEGY_ANALYSIS_TURNS,
} from "./strategic-context";
import { isAnalysisApplicable } from "./analysis-version";
import { parseStrategyPlan } from "./strategy-plan";
import { z } from "zod";
import type { GameState, CardName } from "../types/game-state";
import { buildCardReference } from "./system-prompt";
import { strategyPlanSchema } from "./strategy-plan";

export function buildStrategyAnalysisPrompt(
  supply: Record<CardName, number>,
): string {
  const previousAnalysisGuidance = `
CONTINUITY:
- The previous plan is unverified advice. Recheck every assumption against CARD DEFINITIONS and current state before reusing it.
- Do not preserve an earlier claim merely for continuity.
- Celebrate when players make smart pivots or ignore your advice for something better
- Admit when your recommendation was wrong or didn't account for something
- Track whether strategies are working out as expected`;

  return `Data is TOON-encoded (self-documenting, tab-delimited).

You are a Dominion strategy analyst with personality - think Patrick Chapin analyzing a Magic game. Write engaging strategic commentary.

${buildCardReference(supply)}

For each playerId, provide:
1. **Gameplan** (1 line): What they're doing (Big Money/Engine/Hybrid) and current standing
2. **Read** (2-3 sentences): Paragraph analyzing their deck, execution, and position. Be specific about card synergies, buying patterns, and deck quality. Include their main weakness.
3. **Recommendation** (1-2 sentences): What they should do next and why. Be decisive and actionable.
4. **decisionPlan**: A compact priority (at most 240 characters) and 1-3 conditions (at most 160 characters each) describing when to pursue it or pivot. Derive it afresh from current facts and card definitions. Do not copy commentary or restate card mechanics. This is the only advice passed to the decision player.
${previousAnalysisGuidance}

Compare this player with every opponent, including VP leads and pile-ending threats. Prefer conditional plans with pivot conditions over unconditional purchase rules. Be analytical but engaging. No fluff - every word should matter.`;
}

export const PlayerAnalysisSchema = z.object({
  decisionPlan: strategyPlanSchema,
  gameplan: z
    .string()
    .describe("One-line summary of strategy and current standing"),
  read: z
    .string()
    .describe(
      "2-3 sentence paragraph analyzing deck quality, execution, and weakness",
    ),
  recommendation: z
    .string()
    .describe("1-2 sentences on what to do next and why - be decisive"),
});

export type PlayerAnalysisRecord = Record<
  string,
  z.infer<typeof PlayerAnalysisSchema>
>;

export function buildStrategyAnalysisMessage(
  state: GameState,
  playerId: string,
  previous: unknown,
): string {
  const parsed = previousAnalysisSchema.safeParse(previous);
  const candidate = parsed.success ? parsed.data : undefined;
  const previousPlan =
    candidate &&
    (!candidate.analysis || isAnalysisApplicable(candidate.analysis, state))
      ? parseStrategyPlan(candidate.decisionPlan)
      : undefined;
  return `${encodeToon({ turn: state.turn, phase: state.phase, supply: state.supply, trash: state.trash })}

${formatTurnHistoryForAnalysis(state, STRATEGY_ANALYSIS_TURNS)}

PUBLIC PLAYER SUMMARIES (history uses these exact player IDs):
${encodeToon(buildPublicPlayerSummaries(state))}${previousPlan ? `\n\nPREVIOUS PLAN (unverified advice):\n${encodeToon(previousPlan)}` : ""}

Provide strategic analysis for playerId: ${playerId}.`;
}

const previousAnalysisSchema = z.object({
  decisionPlan: strategyPlanSchema.optional(),
  analysis: z
    .object({
      turn: z.number().int().nonnegative(),
      gameEventId: z.string(),
      sourceEventId: z.string(),
    })
    .optional(),
});
