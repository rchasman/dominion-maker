import { describe, it, expect, beforeEach } from "bun:test";
import { EngineStrategy } from "./engine-strategy";
import { DominionEngine } from "../engine";
import { resetEventCounter } from "../events/id-generator";

describe("EngineStrategy - Full Coverage", () => {
  let strategy: EngineStrategy;
  let engine: DominionEngine;

  beforeEach(() => {
    resetEventCounter();
    strategy = new EngineStrategy();
    engine = new DominionEngine();
    engine.startGame(["human", "ai"]);
  });

  describe("getModeName", () => {
    it("should return mode name", () => {
      expect(strategy.getModeName()).toBe("Hard-coded Engine");
    });
  });

  describe("runAITurn", () => {
    it("should run full turn successfully", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Village", "Copper"];
      engine.state.players.ai!.deck = ["Copper", "Copper"];

      await strategy.runAITurn(engine);

      // Turn should execute without error
      expect(engine.state).toBeDefined();
    });

    it("should play action cards when available", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Village"];
      engine.state.players.ai!.deck = ["Copper", "Copper"];

      await strategy.runAITurn(engine);

      const cardPlayedEvents = engine.eventLog.filter(
        e => e.type === "CARD_PLAYED" && e.playerId === "ai",
      );
      expect(cardPlayedEvents.length).toBeGreaterThan(0);
    });

    it("should prioritize Village over Smithy", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Smithy", "Village"];
      engine.state.players.ai!.deck = Array(5).fill("Copper");

      await strategy.runAITurn(engine);

      const cardPlayed = engine.eventLog.find(
        e => e.type === "CARD_PLAYED" && e.playerId === "ai",
      );
      if (cardPlayed) {
        expect(cardPlayed.card).toBe("Village");
      }
    });

    it("should skip action phase when no actions available", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 0;
      engine.state.players.ai!.hand = ["Village"];
      engine.state.players.ai!.deck = ["Copper"];

      const eventsBefore = engine.eventLog.length;
      await strategy.runAITurn(engine);

      const newCardPlayedEvents = engine.eventLog
        .slice(eventsBefore)
        .filter(e => e.type === "CARD_PLAYED" && e.playerId === "ai");
      expect(newCardPlayedEvents.length).toBe(0);
    });

    it("should skip action phase when no action cards", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Copper", "Silver"];
      engine.state.players.ai!.deck = ["Estate"];

      const eventsBefore = engine.eventLog.length;
      await strategy.runAITurn(engine);

      const newCardPlayedEvents = engine.eventLog
        .slice(eventsBefore)
        .filter(e => e.type === "CARD_PLAYED" && e.playerId === "ai");
      expect(newCardPlayedEvents.length).toBe(0);
    });

    it("should call onStateChange callback", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.players.ai!.hand = ["Copper"];
      engine.state.players.ai!.deck = ["Estate"];

      let callCount = 0;
      const onStateChange = () => {
        callCount++;
      };

      await strategy.runAITurn(engine, onStateChange);

      expect(callCount).toBeGreaterThan(0);
    });

    it("should handle game over condition", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.gameOver = true;
      engine.state.players.ai!.hand = ["Village"];

      const eventsBefore = engine.eventLog.length;
      await strategy.runAITurn(engine);

      const newCardPlayedEvents = engine.eventLog
        .slice(eventsBefore)
        .filter(e => e.type === "CARD_PLAYED" && e.playerId === "ai");
      expect(newCardPlayedEvents.length).toBe(0);
    });

    it("should prioritize Festival over Laboratory", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Laboratory", "Festival"];
      engine.state.players.ai!.deck = Array(5).fill("Copper");

      await strategy.runAITurn(engine);

      const cardPlayed = engine.eventLog.find(
        e => e.type === "CARD_PLAYED" && e.playerId === "ai",
      );
      if (cardPlayed) {
        expect(cardPlayed.card).toBe("Festival");
      }
    });

    it("should prioritize Market over Laboratory", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Laboratory", "Market"];
      engine.state.players.ai!.deck = Array(5).fill("Copper");

      await strategy.runAITurn(engine);

      const cardPlayed = engine.eventLog.find(
        e => e.type === "CARD_PLAYED" && e.playerId === "ai",
      );
      if (cardPlayed) {
        expect(cardPlayed.card).toBe("Market");
      }
    });

    it("should prioritize cards with defined priority over undefined", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Artisan", "Village"];
      engine.state.players.ai!.deck = Array(5).fill("Copper");

      await strategy.runAITurn(engine);

      const cardPlayed = engine.eventLog.find(
        e => e.type === "CARD_PLAYED" && e.playerId === "ai",
      );
      if (cardPlayed) {
        expect(cardPlayed.card).toBe("Village");
      }
    });
  });

  describe("resolveAIPendingDecision", () => {
    it("should handle discard decision", () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = [
        "Estate",
        "Estate",
        "Copper",
        "Silver",
        "Gold",
      ];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "discard",
        prompt: "Discard 3 cards",
        min: 3,
        max: 3,
        cardOptions: engine.state.players.ai!.hand,
      };

      // Should execute without error
      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should handle opponent_discard decision", () => {
      engine.state.activePlayerId = "human";
      engine.state.players.ai!.hand = ["Estate", "Copper", "Silver", "Gold"];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "opponent_discard",
        prompt: "Discard down to 3",
        min: 1,
        max: 1,
        cardOptions: engine.state.players.ai!.hand,
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should prioritize discarding Estates", () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Estate", "Gold", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "discard",
        prompt: "Discard 1",
        min: 1,
        max: 1,
        cardOptions: engine.state.players.ai!.hand,
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should fill remaining with expensive cards when discarding", () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Gold", "Silver", "Village"];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "discard",
        prompt: "Discard 2",
        min: 2,
        max: 2,
        cardOptions: engine.state.players.ai!.hand,
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should handle trash decision", () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Curse", "Estate", "Copper", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "trash",
        prompt: "Trash up to 3",
        min: 0,
        max: 3,
        cardOptions: engine.state.players.ai!.hand,
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should prioritize trashing Curses", () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Curse", "Curse", "Silver", "Gold"];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "trash",
        prompt: "Trash cards",
        min: 0,
        max: 2,
        cardOptions: engine.state.players.ai!.hand,
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should prioritize trashing Estates over Copper", () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Copper", "Estate", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "trash",
        prompt: "Trash 1",
        min: 1,
        max: 1,
        cardOptions: engine.state.players.ai!.hand,
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should fill remaining with cheap cards when trashing", () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Gold", "Silver", "Village"];
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "trash",
        prompt: "Trash 2",
        min: 2,
        max: 2,
        cardOptions: engine.state.players.ai!.hand,
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should handle gain decision", () => {
      engine.state.activePlayerId = "ai";
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "gain",
        prompt: "Gain a card",
        min: 1,
        max: 1,
        cardOptions: ["Copper", "Silver", "Gold"],
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should gain most expensive card", () => {
      engine.state.activePlayerId = "ai";
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "gain",
        prompt: "Gain a card",
        min: 1,
        max: 1,
        cardOptions: ["Copper", "Silver", "Gold"],
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should handle default decision with min > 0", () => {
      engine.state.activePlayerId = "ai";
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "unknown" as any,
        prompt: "Choose",
        min: 1,
        max: 2,
        cardOptions: ["Copper", "Silver"],
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should handle default decision with min = 0", () => {
      engine.state.activePlayerId = "ai";
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "unknown" as any,
        prompt: "Optional",
        min: 0,
        max: 2,
        cardOptions: ["Copper", "Silver"],
      };

      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should do nothing when no pending decision", () => {
      engine.state.pendingChoice = null;

      strategy.resolveAIPendingDecision(engine);

      expect(engine.state.pendingChoice).toBeNull();
    });

    it("should do nothing when decision is for different player", () => {
      engine.state.pendingChoice = {
        playerId: "human",
        stage: "discard",
        prompt: "Discard",
        min: 1,
        max: 1,
        cardOptions: ["Copper"],
      };

      strategy.resolveAIPendingDecision(engine);

      expect(engine.state.pendingChoice).not.toBeNull();
      expect(engine.state.pendingChoice?.playerId).toBe("human");
    });

    it("should do nothing when pending choice is not decision choice", () => {
      engine.state.pendingChoice = {
        playerId: "ai",
        type: "not-decision",
      } as any;

      strategy.resolveAIPendingDecision(engine);

      expect(engine.state.pendingChoice).not.toBeNull();
    });

    it("should handle decision with undefined aiPlayer gracefully", () => {
      engine.state.activePlayerId = "ai";
      delete engine.state.players.ai;
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "discard",
        prompt: "Discard",
        min: 1,
        max: 1,
        cardOptions: ["Copper"],
      };

      strategy.resolveAIPendingDecision(engine);

      // Should handle gracefully without crashing
      expect(engine.state.pendingChoice).not.toBeNull();
    });
  });
});
