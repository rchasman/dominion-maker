import { describe, it, expect, mock, beforeEach } from "bun:test";
import { advanceGameStateWithConsensus } from "./game-agent";
import { DominionEngine } from "../engine";
import { resetEventCounter } from "../events/id-generator";
import type { LLMLogEntry } from "../components/LLMLog";

describe("Consensus System", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("preserves model reasonings in voting data", async () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    const logEntries: LLMLogEntry[] = [];

    const logger = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
      logEntries.push({
        ...entry,
        id: `entry-${logEntries.length}`,
        timestamp: Date.now(),
      });
    };

    // Mock the backend to return actions with reasoning
    const originalFetch = global.fetch;
    global.fetch = mock((url: string) => {
      if (url.includes("/api/generate-action")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              action: { type: "end_phase", reasoning: "Test reasoning" },
              format: "json",
            }),
        });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      await advanceGameStateWithConsensus(engine, "player1", {
        providers: ["gpt-4o-mini"],
        logger,
      });

      // Find the consensus-voting log entry
      const votingEntry = logEntries.find(e => e.type === "consensus-voting");
      expect(votingEntry).toBeDefined();

      const votingData = votingEntry?.data;
      expect(votingData).toBeDefined();

      // Check that allResults contains reasonings
      const allResults = votingData?.allResults as Array<{
        reasonings?: Array<{ provider: string; reasoning?: string }>;
      }>;
      expect(allResults).toBeDefined();
      expect(allResults.length).toBeGreaterThan(0);

      // Verify at least one result has reasoning
      const hasReasoning = allResults.some(
        result =>
          result.reasonings &&
          result.reasonings.length > 0 &&
          result.reasonings.some(r => r.reasoning === "Test reasoning"),
      );
      expect(hasReasoning).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
