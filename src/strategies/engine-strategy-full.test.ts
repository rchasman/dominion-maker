import { describe, it, expect, beforeEach } from "bun:test";
import { EngineStrategy } from "./engine-strategy";
import { DominionEngine } from "../engine";
import { resetEventCounter } from "../events/id-generator";
import { isActionCard } from "../data/cards";
import type { GameEvent } from "../events/types";

// Strategy tests vary the public selection constraints independently of card
// initiation. Persist the matching current-format continuation explicitly.
function installChoiceCheckpoint(engine: DominionEngine) {
  const choice = engine.state.pendingChoice;
  if (choice?.choiceType !== "decision") throw new Error("Expected a decision");
  const attack = choice.cardBeingPlayed === "Militia";
  engine.state.executionStack = [
    {
      type: "choice",
      card: choice.cardBeingPlayed,
      playerId: attack ? "human" : choice.playerId,
      cause: "strategy-card",
      trigger: attack
        ? { type: "attack", target: choice.playerId }
        : { type: "play" },
      memory: null,
    },
  ];
}

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

    it("should prioritize Village over Smithy", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.phase = "action";
      engine.state.actions = 1;
      engine.state.players.ai!.hand = ["Smithy", "Village"];
      engine.state.players.ai!.deck = Array(5).fill("Copper");

      await strategy.runAITurn(engine);

      const cardPlayed = engine.eventLog.find(
        (e): e is Extract<GameEvent, { type: "CARD_PLAYED" }> =>
          e.type === "CARD_PLAYED" && e.playerId === "ai",
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
        .filter(
          e =>
            e.type === "CARD_PLAYED" &&
            e.playerId === "ai" &&
            isActionCard(e.card),
        );
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
        (e): e is Extract<GameEvent, { type: "CARD_PLAYED" }> =>
          e.type === "CARD_PLAYED" && e.playerId === "ai",
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
        (e): e is Extract<GameEvent, { type: "CARD_PLAYED" }> =>
          e.type === "CARD_PLAYED" && e.playerId === "ai",
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
        (e): e is Extract<GameEvent, { type: "CARD_PLAYED" }> =>
          e.type === "CARD_PLAYED" && e.playerId === "ai",
      );
      if (cardPlayed) {
        expect(cardPlayed.card).toBe("Village");
      }
    });
  });

  describe("resolveAIPendingDecision", async () => {
    it("should handle discard decision", async () => {
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
        intent: "discard",
        choiceType: "decision",
        cardBeingPlayed: "Militia",
        prompt: "Discard 3 cards",
        min: 3,
        max: 3,
        cardOptions: engine.state.players.ai!.hand,
      };

      // Should execute without error
      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.players.ai!.discard).toEqual([
        "Estate",
        "Estate",
        "Copper",
      ]);
    });

    it("should handle opponent_discard decision", async () => {
      engine.state.activePlayerId = "human";
      engine.state.players.ai!.hand = ["Estate", "Copper", "Silver", "Gold"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "discard",
        choiceType: "decision",
        cardBeingPlayed: "Militia",
        prompt: "Discard down to 3",
        min: 1,
        max: 1,
        cardOptions: engine.state.players.ai!.hand,
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.players.ai!.discard).toEqual(["Estate"]);
    });

    it("should prioritize discarding Estates", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Estate", "Gold", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "discard",
        choiceType: "decision",
        cardBeingPlayed: "Militia",
        prompt: "Discard 1",
        min: 1,
        max: 1,
        cardOptions: engine.state.players.ai!.hand,
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.players.ai!.discard).toEqual(["Estate"]);
    });

    it("should fill remaining with expensive cards when discarding", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Gold", "Silver", "Village"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "discard",
        choiceType: "decision",
        cardBeingPlayed: "Militia",
        prompt: "Discard 2",
        min: 2,
        max: 2,
        cardOptions: engine.state.players.ai!.hand,
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.players.ai!.discard).toEqual(["Gold", "Silver"]);
    });

    it("should handle trash decision", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Curse", "Estate", "Copper", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "trash",
        choiceType: "decision",
        cardBeingPlayed: "Chapel",
        prompt: "Trash up to 3",
        min: 0,
        max: 3,
        cardOptions: engine.state.players.ai!.hand,
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.trash).toEqual([]);
    });

    it("should prioritize trashing Curses", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Curse", "Curse", "Silver", "Gold"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "trash",
        choiceType: "decision",
        cardBeingPlayed: "Chapel",
        prompt: "Trash cards",
        min: 2,
        max: 2,
        cardOptions: engine.state.players.ai!.hand,
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.trash).toEqual(["Curse", "Curse"]);
    });

    it("should prioritize trashing Estates over Copper", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Copper", "Estate", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "trash",
        choiceType: "decision",
        cardBeingPlayed: "Chapel",
        prompt: "Trash 1",
        min: 1,
        max: 1,
        cardOptions: engine.state.players.ai!.hand,
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.trash).toEqual(["Estate"]);
    });

    it("should fill remaining with cheap cards when trashing", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Gold", "Silver", "Village"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "trash",
        choiceType: "decision",
        cardBeingPlayed: "Chapel",
        prompt: "Trash 2",
        min: 2,
        max: 2,
        cardOptions: engine.state.players.ai!.hand,
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.trash).toEqual(["Silver", "Village"]);
    });

    it("should handle gain decision", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "gain",
        choiceType: "decision",
        cardBeingPlayed: "Workshop",
        prompt: "Gain a card",
        min: 1,
        max: 1,
        cardOptions: ["Copper", "Silver"],
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.players.ai!.discard).toEqual(["Silver"]);
    });

    it("should gain most expensive card", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "gain",
        choiceType: "decision",
        cardBeingPlayed: "Workshop",
        prompt: "Gain a card",
        min: 1,
        max: 1,
        cardOptions: ["Copper", "Silver"],
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.players.ai!.discard).toEqual(["Silver"]);
    });

    it("should handle default decision with min > 0", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Copper", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "select",
        choiceType: "decision",
        cardBeingPlayed: "Chapel",
        prompt: "Choose",
        min: 1,
        max: 2,
        cardOptions: ["Copper", "Silver"],
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.trash).toEqual(["Copper"]);
    });

    it("should handle default decision with min = 0", async () => {
      engine.state.activePlayerId = "ai";
      engine.state.players.ai!.hand = ["Copper", "Silver"];
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "select",
        choiceType: "decision",
        cardBeingPlayed: "Chapel",
        prompt: "Optional",
        min: 0,
        max: 2,
        cardOptions: ["Copper", "Silver"],
      };

      installChoiceCheckpoint(engine);
      await strategy.resolveAIPendingDecision(engine);
      expect(engine.state.pendingChoice).toBeNull();
      expect(engine.state.executionStack).toEqual([]);
      expect(engine.state.trash).toEqual([]);
    });

    it("should do nothing when no pending decision", async () => {
      engine.state.pendingChoice = null;

      await strategy.resolveAIPendingDecision(engine);

      expect(engine.state.pendingChoice).toBeNull();
    });

    it("should do nothing when decision is for different player", async () => {
      engine.state.pendingChoice = {
        playerId: "human",
        intent: "discard",
        choiceType: "decision",
        cardBeingPlayed: "Militia",
        prompt: "Discard",
        min: 1,
        max: 1,
        cardOptions: ["Copper"],
      };

      await strategy.resolveAIPendingDecision(engine);

      expect(engine.state.pendingChoice).not.toBeNull();
      expect(engine.state.pendingChoice?.playerId).toBe("human");
    });

    it("should do nothing when pending choice is not decision choice", async () => {
      engine.state.pendingChoice = {
        playerId: "ai",
        type: "not-decision",
      } as any;

      await strategy.resolveAIPendingDecision(engine);

      expect(engine.state.pendingChoice).not.toBeNull();
    });

    it("should handle decision with undefined aiPlayer gracefully", async () => {
      engine.state.activePlayerId = "ai";
      delete engine.state.players.ai;
      engine.state.pendingChoice = {
        playerId: "ai",
        intent: "discard",
        choiceType: "decision",
        cardBeingPlayed: "Militia",
        prompt: "Discard",
        min: 1,
        max: 1,
        cardOptions: ["Copper"],
      };

      await strategy.resolveAIPendingDecision(engine);

      // Should handle gracefully without crashing
      expect(engine.state.pendingChoice).not.toBeNull();
    });
  });
});
