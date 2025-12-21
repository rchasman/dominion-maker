import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
  advanceGameStateWithConsensus,
  runAITurnWithConsensus,
  abortOngoingConsensus,
} from "./game-agent";
import { DominionEngine } from "../engine";
import { resetEventCounter } from "../events/id-generator";

describe("game-agent", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("abortOngoingConsensus", () => {
    it("should abort ongoing consensus operations", () => {
      // This function aborts global consensus state
      // Just verify it doesn't throw
      expect(() => abortOngoingConsensus()).not.toThrow();
    });
  });

  describe("advanceGameStateWithConsensus", () => {
    it("should handle single legal action without consensus", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      // Set up state with only one legal action (end_phase)
      engine.state.players["player1"]!.hand = ["Copper", "Copper"];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 0; // No actions, only end_phase available

      const originalFetch = global.fetch;
      global.fetch = mock(() => {
        throw new Error("Should not call API when only one legal action");
      }) as typeof fetch;

      try {
        await advanceGameStateWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
        });

        // Should have moved to buy phase
        expect(engine.state.phase).toBe("buy");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should handle errors gracefully", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.players["player1"]!.hand = [
        "Village",
        "Smithy",
        "Copper",
      ];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 1;

      const originalFetch = global.fetch;
      global.fetch = mock(() => {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { value: "API error" } }),
        });
      }) as typeof fetch;

      try {
        await expect(
          advanceGameStateWithConsensus(engine, "player1", {
            providers: ["gpt-4o-mini"],
          }),
        ).rejects.toThrow();
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should include strategic context when provided", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.players["player1"]!.hand = ["Village"];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 1;

      let capturedStrategy: string | undefined;
      const originalFetch = global.fetch;
      global.fetch = mock((url: string, options: any) => {
        const body = JSON.parse(options?.body || "{}");
        capturedStrategy = body.strategySummary;

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              action: { type: "play_action", card: "Village" },
            }),
        });
      }) as typeof fetch;

      try {
        await advanceGameStateWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
          strategySummary: "Test strategy",
        });

        expect(capturedStrategy).toBe("Test strategy");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should include custom strategy when provided", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.players["player1"]!.hand = ["Village"];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 1;

      let capturedCustomStrategy: string | undefined;
      const originalFetch = global.fetch;
      global.fetch = mock((url: string, options: any) => {
        const body = JSON.parse(options?.body || "{}");
        capturedCustomStrategy = body.customStrategy;

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              action: { type: "play_action", card: "Village" },
            }),
        });
      }) as typeof fetch;

      try {
        await advanceGameStateWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
          customStrategy: "Always buy Silver",
        });

        expect(capturedCustomStrategy).toBe("Always buy Silver");
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe("runAITurnWithConsensus", () => {
    it("should run complete AI turn", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.players["player1"]!.hand = ["Copper", "Copper"];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 1;

      const originalFetch = global.fetch;
      let callCount = 0;
      global.fetch = mock((url: string, options: any) => {
        callCount++;
        const body = JSON.parse(options?.body || "{}");

        // First call: end action phase
        if (body.currentState.phase === "action") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ action: { type: "end_phase" } }),
          });
        }

        // Second call: play treasure
        if (body.legalActions.some((a: any) => a.type === "play_treasure")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                action: { type: "play_treasure", card: "Copper" },
              }),
          });
        }

        // Third call: end buy phase
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ action: { type: "end_phase" } }),
        });
      }) as typeof fetch;

      try {
        await runAITurnWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
        });

        // Should have completed turn
        expect(engine.state.activePlayerId).toBe("player2");
        expect(callCount).toBeGreaterThan(0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should stop when game is over", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.gameOver = true;
      engine.state.activePlayerId = "player1";

      const originalFetch = global.fetch;
      global.fetch = mock(() => {
        throw new Error("Should not call API when game is over");
      }) as typeof fetch;

      try {
        await runAITurnWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
        });

        // Should do nothing
        expect(engine.state.gameOver).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should stop when opponent has pending decision", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.activePlayerId = "player1";
      engine.state.pendingChoice = {
        choiceType: "decision",
        playerId: "player2", // Opponent's decision
        prompt: "Discard cards",
        min: 0,
        max: 2,
        cardOptions: ["Copper"],
        stage: "discard",
        from: "hand",
      };

      const originalFetch = global.fetch;
      global.fetch = mock(() => {
        throw new Error("Should not call API when opponent has decision");
      }) as typeof fetch;

      try {
        await runAITurnWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
        });

        // Should do nothing
        expect(engine.state.pendingChoice?.playerId).toBe("player2");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should handle errors during turn", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.players["player1"]!.hand = ["Village"];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 1;

      const originalFetch = global.fetch;
      global.fetch = mock(() => {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { value: "API error" } }),
        });
      }) as typeof fetch;

      try {
        // Should not throw, but should stop trying after error
        await runAITurnWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
        });

        // Should still be player1's turn (error prevented progress)
        expect(engine.state.activePlayerId).toBe("player1");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should call onStateChange callback", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.players["player1"]!.hand = ["Copper"];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 0;

      const stateChanges: string[] = [];
      const onStateChange = (state: any) => {
        stateChanges.push(state.phase);
      };

      const originalFetch = global.fetch;
      global.fetch = mock((url: string, options: any) => {
        const body = JSON.parse(options?.body || "{}");

        if (body.currentState.phase === "action") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ action: { type: "end_phase" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ action: { type: "end_phase" } }),
        });
      }) as typeof fetch;

      try {
        await runAITurnWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
          onStateChange,
        });

        // Should have received state change callbacks
        expect(stateChanges.length).toBeGreaterThan(0);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should respect MAX_TURN_STEPS limit", async () => {
      const engine = new DominionEngine();
      engine.startGame(["player1", "player2"]);

      engine.state.players["player1"]!.hand = ["Village"];
      engine.state.activePlayerId = "player1";
      engine.state.phase = "action";
      engine.state.actions = 1;

      const originalFetch = global.fetch;
      let callCount = 0;
      global.fetch = mock(() => {
        callCount++;
        // Always return Village to create infinite loop
        // (in real game this would fail validation, but tests the limit)
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ action: { type: "play_action", card: "Village" } }),
        });
      }) as typeof fetch;

      try {
        await runAITurnWithConsensus(engine, "player1", {
          providers: ["gpt-4o-mini"],
        });

        // Should have stopped due to MAX_TURN_STEPS (20)
        // Even if actions fail, it should prevent infinite loops
        expect(callCount).toBeLessThanOrEqual(25); // Some buffer for safety
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
