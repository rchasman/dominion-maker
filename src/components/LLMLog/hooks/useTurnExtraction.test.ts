import { describe, expect, it } from "bun:test";
import type { LLMLogEntry } from "../types";
import { extractTurns, hasLiveConsensus } from "./useTurnExtraction";

const entry = (
  type: LLMLogEntry["type"],
  data: Record<string, unknown> = {},
): LLMLogEntry => ({
  id: `${type}-${Math.random()}`,
  timestamp: 1,
  type,
  message: type,
  data,
});

const modelRound = [
  entry("consensus-model-pending", { provider: "gpt-5.4-mini", index: 0 }),
  entry("consensus-model-complete", { index: 0, duration: 5, success: true }),
];

describe("hasLiveConsensus", () => {
  it("is live while a consensus has started and no winner is logged", () => {
    const turns = extractTurns([
      entry("ai-turn-start", { turn: 1 }),
      entry("consensus-start", { turn: 1 }),
      ...modelRound,
    ]);
    expect(hasLiveConsensus(turns)).toBe(true);
  });

  it("stops once the winner is logged even when no model was aborted", () => {
    const turns = extractTurns([
      entry("ai-turn-start", { turn: 1 }),
      entry("consensus-start", { turn: 1 }),
      ...modelRound,
      entry("consensus-voting", { topResult: { votes: 1 } }),
    ]);
    expect(hasLiveConsensus(turns)).toBe(false);
  });

  it("stops when the consensus step fails", () => {
    const turns = extractTurns([
      entry("ai-turn-start", { turn: 1 }),
      entry("consensus-start", { turn: 1 }),
      entry("consensus-step-error", { error: "All AI models failed" }),
    ]);
    expect(hasLiveConsensus(turns)).toBe(false);
  });

  it("is quiet for a game with no consensus yet", () => {
    expect(hasLiveConsensus(extractTurns([entry("ai-turn-start")]))).toBe(
      false,
    );
  });
});
