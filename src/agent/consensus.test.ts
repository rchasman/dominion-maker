import { describe, it, expect, mock, beforeEach } from "bun:test";
import { advanceGameStateWithConsensus } from "./game-agent";
import { DominionEngine } from "../engine";
import { resetEventCounter } from "../events/id-generator";
import type { LLMLogEntry } from "../components/LLMLog";
import { isDecisionChoice } from "../types/game-state";

describe("Consensus System", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("preserves model reasonings in voting data", async () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    // Set up game state with multiple action cards to trigger consensus
    engine.state.players.player1.hand = [
      "Smithy",
      "Village",
      "Market",
      "Copper",
      "Copper",
    ];
    engine.state.activePlayerId = "player1";
    engine.state.phase = "action";
    engine.state.actions = 1;

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
              action: {
                type: "play_action",
                card: "Smithy",
                reasoning: "Test reasoning",
              },
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

  it("handles multi-round batch consensus for Chapel", async () => {
    const engine = new DominionEngine();
    engine.startGame(["player1", "player2"]);

    // Give player Chapel and cards
    engine.state.players.player1.hand = [
      "Chapel",
      "Copper",
      "Copper",
      "Estate",
      "Duchy",
    ];
    engine.state.activePlayerId = "player1";
    engine.state.phase = "action";
    engine.state.actions = 1;

    // Play Chapel to create batch decision
    const playResult = engine.dispatch({
      type: "PLAY_ACTION",
      playerId: "player1",
      card: "Chapel",
    });

    expect(playResult.ok).toBe(true);
    expect(engine.state.pendingChoice).toBeDefined();
    expect(isDecisionChoice(engine.state.pendingChoice)).toBe(true);
    if (isDecisionChoice(engine.state.pendingChoice)) {
      expect(engine.state.pendingChoice.max).toBe(4);
    }

    let roundCount = 0;
    const votedActions: string[] = [];

    // Mock backend to vote on atomic actions
    const originalFetch = global.fetch;
    global.fetch = mock((url: string) => {
      if (url.includes("/api/generate-action")) {
        roundCount++;

        const responses = [
          // Round 1: trash Copper
          { type: "trash_card", card: "Copper" },
          // Round 2: trash Estate
          { type: "trash_card", card: "Estate" },
          // Round 3: trash another Copper
          { type: "trash_card", card: "Copper" },
          // Round 4+: trash Duchy
          { type: "trash_card", card: "Duchy" },
        ];

        const action =
          responses[Math.min(roundCount - 1, responses.length - 1)];
        votedActions.push(
          `${action.type}${action.card ? `(${action.card})` : ""}`,
        );

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              action,
              format: "json",
            }),
        });
      }
      return originalFetch(url);
    }) as typeof fetch;

    try {
      await advanceGameStateWithConsensus(engine, "player1", {
        providers: ["gpt-4o-mini"],
      });

      // Verify multi-round consensus ran 4 times (all cards)
      expect(roundCount).toBe(4);
      expect(votedActions.length).toBe(4);

      // Verify batch was submitted to Chapel
      expect(engine.state.trash.length).toBe(4); // Trashed all 4 cards
      expect(engine.state.trash).toContain("Copper");
      expect(engine.state.trash).toContain("Estate");
      expect(engine.state.trash).toContain("Duchy");

      // Verify Copper appears twice in trash (had 2 in hand)
      const coppersInTrash = engine.state.trash.filter(
        c => c === "Copper",
      ).length;
      expect(coppersInTrash).toBe(2);

      // Verify no pending decision (Chapel finished)
      expect(engine.state.pendingChoice).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
