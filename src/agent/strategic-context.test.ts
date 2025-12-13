import { describe, it, expect } from "bun:test";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "./strategic-context";
import type { GameState, PlayerState } from "../types/game-state";

function createMockGameState(
  activePlayer: string,
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
    activePlayer,
    turn: 1,
    phase: "action",
    subPhase: null,
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
    winner: null,
    turnHistory: [],
    kingdomCards: [],
    pendingDecision: null,
    pendingDecisionEventId: null,
  };
}

describe("buildStrategicContext", () => {
  describe("with human vs ai players", () => {
    it("should build minimal strategic context", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // Core strategic insights only
      expect(context).toContain("gameStage:");
      expect(context).toContain("yourVictoryPoints:");
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("opponentDeckComposition:");

      // All derivable stats removed
      expect(context).not.toContain("currentTurnNumber:");
      expect(context).not.toContain("yourTreasureCount:");
      expect(context).not.toContain("yourDeckTotalCards:");
      expect(context).not.toContain("yourDeckCycleTime:");
    });

    it("should show correct VP scores", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // Each player has 1 Estate = 1 VP
      expect(context).toContain("yourVictoryPoints: 1");
      expect(context).toContain("opponentVictoryPoints: 1");
    });

    it("should focus on strategic data not redundant state", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // Deck composition is strategic (counts across all zones)
      expect(context).toContain("yourDeckComposition:");
      // Hand is redundant with state.players[player].hand
      expect(context).not.toContain("handCards[");
    });
  });

  describe("with ai1 vs ai2 players", () => {
    it("should build context for ai1 player", () => {
      const state = createMockGameState("ai1", ["ai1", "ai2"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("yourVictoryPoints:");
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("opponentDeckComposition:");
      expect(context).toContain("gameStage:");
    });

    it("should build context for ai2 player", () => {
      const state = createMockGameState("ai2", ["ai1", "ai2"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("yourVictoryPoints:");
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("opponentDeckComposition:");
    });

    it("should show correct perspective for ai1", () => {
      const state = createMockGameState("ai1", ["ai1", "ai2"]);
      state.players.ai1.hand = ["Gold", "Silver"];
      state.players.ai2.hand = ["Copper", "Copper"];

      const context = buildStrategicContext(state);

      // ai1's perspective - deck composition not hand
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("Gold");
      expect(context).not.toContain("handCards[");
    });

    it("should show correct perspective for ai2", () => {
      const state = createMockGameState("ai2", ["ai1", "ai2"]);
      state.players.ai1.hand = ["Gold", "Silver"];
      state.players.ai2.hand = ["Copper", "Copper"];

      const context = buildStrategicContext(state);

      // ai2's perspective - deck composition not hand
      expect(context).toContain("yourDeckComposition:");
      expect(context).not.toContain("handCards[");
    });
  });

  describe("with arbitrary player IDs", () => {
    it("should work with player1 vs player2", () => {
      const state = createMockGameState("player1", ["player1", "player2"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("yourVictoryPoints:");
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("opponentDeckComposition:");
    });

    it("should work with custom player IDs", () => {
      const state = createMockGameState("alice", ["alice", "bob"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("yourVictoryPoints:");
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("opponentDeckComposition:");
    });
  });

  describe("deck composition", () => {
    it("should show composition across all zones", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.players.ai.deck = ["Copper", "Copper", "Estate"];
      state.players.ai.hand = ["Silver"];
      state.players.ai.discard = ["Gold"];
      state.players.ai.inPlay = [];

      const context = buildStrategicContext(state);

      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("Copper: 2");
      expect(context).toContain("Estate: 1");
      expect(context).toContain("Silver: 1");
      expect(context).toContain("Gold: 1");

      // All calculated stats removed
      expect(context).not.toContain("yourDeckTotalCards:");
      expect(context).not.toContain("yourTreasureCount:");
      expect(context).not.toContain("yourTotalTreasureValue:");
    });

    it("should focus on deck composition not zone sizes", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.players.ai.deck = ["Copper", "Copper", "Copper"];
      state.players.ai.discard = ["Silver", "Gold"];

      const context = buildStrategicContext(state);

      expect(context).toContain("yourDeckComposition:");
      // Draw/discard pile sizes are redundant with state
      expect(context).not.toContain("yourDrawPileCount:");
      expect(context).not.toContain("yourDiscardPileCount:");
    });
  });

  describe("supply status", () => {
    it("should not duplicate supply (already in state)", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.supply.Province = 5;
      state.supply.Duchy = 3;

      const context = buildStrategicContext(state);

      // Supply is redundant with state.supply
      expect(context).not.toContain("supplyPiles:");
      // But strategic insights remain
      expect(context).toContain("gameStage:");
    });
  });

  describe("strategy summary integration", () => {
    it("should include strategy summary when provided", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const strategySummary = JSON.stringify([
        {
          id: "human",
          gameplan: "Big Money - Leading with 12 VP",
          read: "Playing textbook Big Money with disciplined Gold/Silver purchases. Deck is clean but lacks action synergy. Main weakness is vulnerability to engine strategies in long games.",
          recommendation:
            "Keep buying Golds. Start greening when opponent completes their engine or at 2 Provinces.",
        },
        {
          id: "ai",
          gameplan: "Engine Building - Behind at 6 VP",
          read: "Building Villages and Smithies engine but execution is slow. Low buying power is the critical weakness. Needs 1-2 more engine pieces before competing.",
          recommendation:
            "Finish the engine before greening. Need at least one more Village.",
        },
      ]);

      const context = buildStrategicContext(state, strategySummary);

      expect(context).toContain("aiStrategyGameplan:");
      expect(context).toContain("Engine Building - Behind at 6 VP");
      expect(context).toContain("Villages and Smithies");
    });

    it("should work without strategy summary", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      expect(context).not.toContain("aiStrategyGameplan:");
      expect(context).toContain("yourVictoryPoints:");
      expect(context).toContain("yourDeckComposition:");
    });
  });

  describe("formatTurnHistoryForAnalysis", () => {
    it("should format recent turns in TOON format", () => {
      const state = createMockGameState("ai", ["human", "ai"]);

      // Add some log entries
      state.log = [
        { type: "turn-start", turn: 1, player: "human" },
        {
          type: "play-action",
          player: "human",
          card: "Village",
          reasoning: "",
        },
        { type: "play-action", player: "human", card: "Smithy", reasoning: "" },
        { type: "buy-card", player: "human", card: "Silver", reasoning: "" },
        { type: "turn-start", turn: 2, player: "ai" },
        { type: "play-action", player: "ai", card: "Market", reasoning: "" },
        { type: "buy-card", player: "ai", card: "Gold", reasoning: "" },
      ];

      const formatted = formatTurnHistoryForAnalysis(state);

      expect(formatted).toContain("RECENT TURN HISTORY:");
      // TOON format should be compact
      expect(formatted).toContain("turn:");
      expect(formatted).toContain("player:");
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
        player: i % 2 === 0 ? "human" : "ai",
      }));

      const formatted3 = formatTurnHistoryForAnalysis(state, "toon", 3);
      const formatted7 = formatTurnHistoryForAnalysis(state, "toon", 7);

      // 7-turn window should be longer
      expect(formatted7.length).toBeGreaterThan(formatted3.length);
    });
  });

  describe("minimal strategic context", () => {
    it("should only include non-derivable strategic insights", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.phase = "buy";
      state.coins = 5;
      state.players.ai.hand = ["Copper", "Silver"];
      state.players.ai.deck = ["Estate", "Copper"];
      state.players.ai.discard = ["Copper", "Copper"];

      const context = buildStrategicContext(state);

      // Core strategic insights only
      expect(context).toContain("gameStage:");
      expect(context).toContain("yourVictoryPoints:");
      expect(context).toContain("opponentVictoryPoints:");
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("opponentDeckComposition:");
      expect(context).toContain("provincesYouNeedToWin:");

      // All derivable/redundant fields removed
      expect(context).not.toContain("currentTurnNumber:");
      expect(context).not.toContain("yourDeckTotalCards:");
      expect(context).not.toContain("yourTreasureCount:");
      expect(context).not.toContain("yourAvgTreasureValue:");
      expect(context).not.toContain("yourDeckCycleTime:");
      expect(context).not.toContain("opponentTotalTreasureValue:");
      expect(context).not.toContain("handCards:");
      expect(context).not.toContain("supplyPiles:");
    });

    it("should be minimal even with complex state", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.phase = "action";
      state.actions = 1;
      state.players.ai.hand = ["Village", "Smithy", "Copper"];

      const context = buildStrategicContext(state);

      // Core insights only
      expect(context).toContain("yourDeckComposition:");
      expect(context).toContain("gameStage:");

      // Everything else removed
      expect(context).not.toContain("yourActionCount:");
      expect(context).not.toContain("buyableWithCurrentCoins:");
    });
  });
});
