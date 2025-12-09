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
  };
}

describe("buildStrategicContext", () => {
  describe("with human vs ai players", () => {
    it("should build context for ai player", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("SCORE:");
      expect(context).toContain("YOUR DECK");
      expect(context).toContain("OPPONENT DECK");
      expect(context).toContain("DRAW PILE:");
      expect(context).toContain("SUPPLY:");
      expect(context).toContain("HAND:");
    });

    it("should show correct VP scores", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      // Each player has 1 Estate = 1 VP
      expect(context).toContain("You 1 VP, Opponent 1 VP");
    });

    it("should show current player's hand", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("HAND: Copper, Estate");
    });
  });

  describe("with ai1 vs ai2 players (full mode)", () => {
    it("should build context for ai1 player", () => {
      const state = createMockGameState("ai1", ["ai1", "ai2"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("SCORE:");
      expect(context).toContain("YOUR DECK");
      expect(context).toContain("OPPONENT DECK");
      expect(context).toContain("DRAW PILE:");
      expect(context).toContain("SUPPLY:");
      expect(context).toContain("HAND:");
    });

    it("should build context for ai2 player", () => {
      const state = createMockGameState("ai2", ["ai1", "ai2"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("SCORE:");
      expect(context).toContain("YOUR DECK");
      expect(context).toContain("OPPONENT DECK");
      expect(context).toContain("HAND:");
    });

    it("should show correct perspective for ai1", () => {
      const state = createMockGameState("ai1", ["ai1", "ai2"]);
      state.players.ai1.hand = ["Gold", "Silver"];
      state.players.ai2.hand = ["Copper", "Copper"];

      const context = buildStrategicContext(state);

      // ai1's perspective should show their own hand
      expect(context).toContain("HAND: Gold, Silver");
      expect(context).not.toContain("Copper, Copper");
    });

    it("should show correct perspective for ai2", () => {
      const state = createMockGameState("ai2", ["ai1", "ai2"]);
      state.players.ai1.hand = ["Gold", "Silver"];
      state.players.ai2.hand = ["Copper", "Copper"];

      const context = buildStrategicContext(state);

      // ai2's perspective should show their own hand
      expect(context).toContain("HAND: Copper, Copper");
      expect(context).not.toContain("Gold, Silver");
    });
  });

  describe("with arbitrary player IDs", () => {
    it("should work with player1 vs player2", () => {
      const state = createMockGameState("player1", ["player1", "player2"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("SCORE:");
      expect(context).toContain("YOUR DECK");
      expect(context).toContain("OPPONENT DECK");
    });

    it("should work with custom player IDs", () => {
      const state = createMockGameState("alice", ["alice", "bob"]);
      const context = buildStrategicContext(state);

      expect(context).toContain("SCORE:");
      expect(context).toContain("YOUR DECK");
      expect(context).toContain("OPPONENT DECK");
    });
  });

  describe("deck analysis", () => {
    it("should calculate treasure value correctly", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.players.ai.hand = ["Gold", "Silver", "Copper"];
      state.coins = 0;

      const context = buildStrategicContext(state);

      // Gold=3, Silver=2, Copper=1 = 6 total
      expect(context).toContain("Unplayed treasures: $6");
      expect(context).toContain("Max coins this turn: $6");
    });

    it("should show deck composition", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.players.ai.deck = ["Copper", "Copper", "Estate"];
      state.players.ai.hand = ["Silver"];
      state.players.ai.discard = ["Gold"];
      state.players.ai.inPlay = [];

      const context = buildStrategicContext(state);

      expect(context).toContain("YOUR DECK (5 cards):");
      expect(context).toContain("2 Copper");
      expect(context).toContain("1 Estate");
      expect(context).toContain("1 Silver");
      expect(context).toContain("1 Gold");
    });

    it("should show draw pile and discard pile sizes", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.players.ai.deck = ["Copper", "Copper", "Copper"];
      state.players.ai.discard = ["Silver", "Gold"];

      const context = buildStrategicContext(state);

      expect(context).toContain("DRAW PILE: 3 cards");
      expect(context).toContain("DISCARD: 2 cards");
    });
  });

  describe("supply status", () => {
    it("should show province and duchy counts", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.supply.Province = 5;
      state.supply.Duchy = 3;

      const context = buildStrategicContext(state);

      expect(context).toContain("Province 5/8");
      expect(context).toContain("Duchy 3/8");
    });

    it("should show low piles", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.supply.Gold = 2;
      state.supply.Silver = 1;

      const context = buildStrategicContext(state);

      expect(context).toContain("Low:");
      expect(context).toContain("Gold: 2");
      expect(context).toContain("Silver: 1");
    });

    it("should show empty piles", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.supply.Copper = 0;

      const context = buildStrategicContext(state);

      expect(context).toContain("Empty:");
      expect(context).toContain("Copper");
    });
  });

  describe("strategy summary integration", () => {
    it("should include strategy summary when provided", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const strategySummary = JSON.stringify({
        human: {
          strategy: "Playing Big Money, focusing on Gold/Silver purchases",
          execution: "Good",
          position: "Leading",
          threats: "None",
          opportunities: "Continue buying Golds",
        },
        ai: {
          strategy: "Building engine with Villages and Smithies",
          execution: "Fair",
          position: "Behind",
          threats: "Low buying power",
          opportunities: "Complete engine",
        },
      });

      const context = buildStrategicContext(state, strategySummary);

      expect(context).toContain("STRATEGY ANALYSIS:");
      expect(context).toContain("Big Money");
      expect(context).toContain("Villages and Smithies");
    });

    it("should work without strategy summary", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      const context = buildStrategicContext(state);

      expect(context).not.toContain("STRATEGY ANALYSIS:");
      expect(context).toContain("SCORE:");
      expect(context).toContain("YOUR DECK");
    });
  });

  describe("formatTurnHistoryForAnalysis", () => {
    it("should format recent turns for LLM analysis", () => {
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
      expect(formatted).toContain("Turn 1");
      expect(formatted).toContain("Turn 2");
      expect(formatted).toContain("Village, Smithy");
      expect(formatted).toContain("Silver");
      expect(formatted).toContain("Market");
      expect(formatted).toContain("Gold");
    });

    it("should return empty string when no turns", () => {
      const state = createMockGameState("ai", ["human", "ai"]);
      state.log = [];

      const formatted = formatTurnHistoryForAnalysis(state);

      expect(formatted).toBe("");
    });
  });
});
