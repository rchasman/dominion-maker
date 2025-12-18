import { describe, it, expect } from "bun:test";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "./strategic-context";
import type { GameState, PlayerState } from "../types/game-state";

function createMockGameState(
  activePlayerId: string,
  playerIds: string[],
): GameState {
  const players: Record<string, PlayerState> = {};

  playerIds.forEach(id => {
    players[id] = {
      deck: ["Copper", "Copper", "Copper"],
      hand: ["Copper", "Estate"],
      discard: ["Silver"],
      inPlay: [],
      inPlaySourceIndices: [],
    };
  });

  return {
    players,
    activePlayerId,
    turn: 1,
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 0,
    supply: {
      Province: 8,
      Duchy: 8,
      Estate: 8,
      Gold: 30,
      Silver: 40,
      Copper: 46,
    },
    trash: [],
    log: [],
    gameOver: false,
    winnerId: null,
    turnHistory: [],
    kingdomCards: [],
    pendingChoice: null,
    pendingChoiceEventId: null,
  };
}

describe("buildStrategicContext", () => {
  describe("with human vs ai players", () => {
    it("should build minimal strategic context", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // Only AI strategy, no game state (moved to main state object)
      expect(context).toContain("aiStrategyGameplan:");
      expect(context).toContain("aiStrategyRead:");
      expect(context).toContain("aiStrategyRecommendation:");

      // Game state facts removed (now in you/opponent objects)
      expect(context).not.toContain("gameStage:");
      expect(context).not.toContain("yourVictoryPoints:");
      expect(context).not.toContain("yourDeckComposition:");
    });

    it("should use default strategy when none provided", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // Default strategy is included
      expect(context).toContain("Build Economy");
      expect(context).toContain("Silver > Copper");
    });

    it("should be compact without game state duplication", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // No zone details (hand, deck, discard - in main state)
      expect(context).not.toContain("handCards[");
      expect(context).not.toContain("deckCards[");
    });
  });

  describe("with ai1 vs ai2 players", () => {
    it("should build context for ai1 player", () => {
      const state = createMockGameState("ai1", ["ai1", "ai2"]);
      const context = buildStrategicContext(state);

      // Only strategy
      expect(context).toContain("aiStrategyGameplan:");
      expect(context).toContain("aiStrategyRead:");
      expect(context).toContain("aiStrategyRecommendation:");
    });

    it("should build context for ai2 player", () => {
      const state = createMockGameState("ai2", ["ai1", "ai2"]);
      const context = buildStrategicContext(state);

      // Only strategy
      expect(context).toContain("aiStrategyGameplan:");
      expect(context).toContain("aiStrategyRead:");
      expect(context).toContain("aiStrategyRecommendation:");
    });

    it("should not expose opponent's hand or private info", () => {
      const state = createMockGameState("ai1", ["ai1", "ai2"]);
      state.players.ai1.hand = ["Witch", "Bandit"];
      state.players.ai2.hand = ["Copper", "Copper"];

      const context = buildStrategicContext(state);

      // No hand details in strategic context (handled in main state)
      expect(context).not.toContain("handCards[");
      expect(context).not.toContain("Witch");
      expect(context).not.toContain("Bandit");
    });
  });

  describe("with arbitrary player IDs", () => {
    it("should work with player1 vs player2", () => {
      const state = createMockGameState("player1", ["player1", "player2"]);
      const context = buildStrategicContext(state);

      // Only strategy
      expect(context).toContain("aiStrategyGameplan:");
    });

    it("should work with custom player IDs", () => {
      const state = createMockGameState("alice", ["alice", "bob"]);
      const context = buildStrategicContext(state);

      // Only strategy
      expect(context).toContain("aiStrategyGameplan:");
    });
  });

  describe("deck composition", () => {
    it("should not contain deck composition (moved to main state)", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.players.ai.deck = ["Copper", "Copper", "Estate"];
      state.players.ai.hand = ["Silver"];
      state.players.ai.discard = ["Gold"];
      state.players.ai.inPlay = [];

      const context = buildStrategicContext(state);

      // Deck composition moved to main state (you.currentDeckComposition)
      expect(context).not.toContain("yourDeckComposition:");
      expect(context).not.toContain("Copper:");
      expect(context).not.toContain("Estate:");

      // Only strategy remains
      expect(context).toContain("aiStrategyGameplan:");
    });

    it("should focus only on AI strategy not state facts", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.players.ai.deck = ["Copper", "Copper", "Copper"];
      state.players.ai.discard = ["Silver", "Gold"];

      const context = buildStrategicContext(state);

      // No deck data
      expect(context).not.toContain("yourDeckComposition:");
      expect(context).not.toContain("yourDrawPileCount:");
      expect(context).not.toContain("yourDiscardPileCount:");
    });
  });

  describe("supply status", () => {
    it("should not duplicate supply or game stage (in main state)", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.supply.Province = 5;
      state.supply.Duchy = 3;

      const context = buildStrategicContext(state);

      // Supply and game stage in main state
      expect(context).not.toContain("supplyPiles:");
      expect(context).not.toContain("gameStage:");

      // Only strategy
      expect(context).toContain("aiStrategyGameplan:");
    });
  });

  describe("strategy summary integration", () => {
    it("should include strategy summary when provided", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const strategySummary = JSON.stringify({
        human: {
          gameplan: "Big Money - Leading with 12 VP",
          read: "Playing textbook Big Money with disciplined Gold/Silver purchases. Deck is clean but lacks action synergy. Main weakness is vulnerability to engine strategies in long games.",
          recommendation:
            "Keep buying Golds. Start greening when opponent completes their engine or at 2 Provinces.",
        },
        ai: {
          gameplan: "Engine Building - Behind at 6 VP",
          read: "Building Villages and Smithies engine but execution is slow. Low buying power is the critical weakness. Needs 1-2 more engine pieces before competing.",
          recommendation:
            "Finish the engine before greening. Need at least one more Village.",
        },
      });

      const context = buildStrategicContext(state, strategySummary);

      expect(context).toContain("aiStrategyGameplan:");
      expect(context).toContain("Engine Building - Behind at 6 VP");
      expect(context).toContain("Villages and Smithies");
    });

    it("should use default strategy when none provided", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // Default strategy is always included
      expect(context).toContain("aiStrategyGameplan:");
      expect(context).toContain("Build Economy");
      expect(context).toContain("Silver > Copper");

      // No game state facts
      expect(context).not.toContain("yourVictoryPoints:");
      expect(context).not.toContain("yourDeckComposition:");
    });
  });

  describe("formatTurnHistoryForAnalysis", () => {
    it("should format recent turns in TOON format", () => {
      const state = createMockGameState("ai", ["human", "ai"]);

      // Add some log entries
      state.log = [
        { type: "turn-start", turn: 1, playerId: "human" },
        {
          type: "play-action",
          playerId: "human",
          card: "Village",
          reasoning: "",
        },
        {
          type: "play-action",
          playerId: "human",
          card: "Smithy",
          reasoning: "",
        },
        { type: "buy-card", playerId: "human", card: "Silver", reasoning: "" },
        { type: "turn-start", turn: 2, playerId: "ai" },
        { type: "play-action", playerId: "ai", card: "Market", reasoning: "" },
        { type: "buy-card", playerId: "ai", card: "Gold", reasoning: "" },
      ];

      const formatted = formatTurnHistoryForAnalysis(state);

      expect(formatted).toContain("RECENT TURN HISTORY:");
      // TOON format should be compact
      expect(formatted).toContain("turn:");
      expect(formatted).toContain("playerId:");
      expect(formatted).toContain("Village");
      expect(formatted).toContain("Silver");
    });

    it("should return empty string when no turns", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.log = [];

      const formatted = formatTurnHistoryForAnalysis(state);

      expect(formatted).toBe("");
    });

    it("should support custom turn count for strategy analysis", () => {
      const state = createMockGameState("ai", ["human", "ai"]);

      // Add 10 turns of history
      state.log = Array.from({ length: 10 }, (_, i) => ({
        type: "turn-start" as const,
        turn: i + 1,
        playerId: i % 2 === 0 ? "human" : "ai",
      }));

      const formatted3 = formatTurnHistoryForAnalysis(state, "toon", 3);
      const formatted7 = formatTurnHistoryForAnalysis(state, "toon", 7);

      // 7-turn window should be longer
      expect(formatted7.length).toBeGreaterThan(formatted3.length);
    });
  });

  describe("minimal strategic context", () => {
    it("should only include AI strategy not game state", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.phase = "buy";
      state.coins = 5;
      state.players.ai.hand = ["Copper", "Silver"];
      state.players.ai.deck = ["Estate", "Copper"];
      state.players.ai.discard = ["Copper", "Copper"];

      const context = buildStrategicContext(state);

      // Only AI strategy
      expect(context).toContain("aiStrategyGameplan:");
      expect(context).toContain("aiStrategyRead:");
      expect(context).toContain("aiStrategyRecommendation:");

      // All game state moved to main state object
      expect(context).not.toContain("gameStage:");
      expect(context).not.toContain("yourVictoryPoints:");
      expect(context).not.toContain("yourDeckComposition:");
      expect(context).not.toContain("currentTurnNumber:");
      expect(context).not.toContain("handCards:");
      expect(context).not.toContain("supplyPiles:");
    });

    it("should be minimal even with complex state", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.phase = "action";
      state.actions = 1;
      state.players.ai.hand = ["Village", "Smithy", "Copper"];

      const context = buildStrategicContext(state);

      // Only strategy
      expect(context).toContain("aiStrategyGameplan:");

      // No state facts
      expect(context).not.toContain("yourDeckComposition:");
      expect(context).not.toContain("gameStage:");
      expect(context).not.toContain("yourActionCount:");
      expect(context).not.toContain("buyableWithCurrentCoins:");
    });
  });
});
