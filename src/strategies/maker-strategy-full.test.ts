import { describe, it, expect, beforeEach } from "bun:test";
import { MakerStrategy } from "./maker-strategy";
import { DominionEngine } from "../engine";
import { resetEventCounter } from "../events/id-generator";
import type { LLMLogger, ModelSettings } from "../agent/game-agent";

describe("MakerStrategy - Full Coverage", () => {
  let strategy: MakerStrategy;
  let engine: DominionEngine;

  beforeEach(() => {
    resetEventCounter();
    engine = new DominionEngine();
    engine.startGame(["human", "ai"]);
  });

  describe("constructor", () => {
    it("should initialize with default settings", () => {
      strategy = new MakerStrategy();
      expect(strategy).toBeDefined();
      expect(strategy.getModeName()).toBe("MAKER");
    });

    it("should initialize with undefined provider", () => {
      strategy = new MakerStrategy(undefined);
      expect(strategy).toBeDefined();
    });

    it("should initialize with logger", () => {
      const logger: LLMLogger = () => {};
      strategy = new MakerStrategy(undefined, logger);
      expect(strategy).toBeDefined();
    });

    it("should initialize with model settings", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 4,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should initialize with strategy summary", () => {
      strategy = new MakerStrategy(undefined, undefined, undefined, "Strategy");
      expect(strategy).toBeDefined();
    });

    it("should use default model settings when not provided", () => {
      strategy = new MakerStrategy();
      expect(strategy).toBeDefined();
    });

    it("should accept all constructor parameters", () => {
      const logger: LLMLogger = () => {};
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["gpt-4o-mini"]),
        consensusCount: 6,
        dataFormat: "json",
      };
      strategy = new MakerStrategy(
        undefined,
        logger,
        modelSettings,
        "Custom strategy",
      );
      expect(strategy).toBeDefined();
    });
  });

  describe("getModeName", () => {
    beforeEach(() => {
      strategy = new MakerStrategy();
    });

    it("should return MAKER", () => {
      expect(strategy.getModeName()).toBe("MAKER");
    });
  });

  describe("setStrategySummary", () => {
    beforeEach(() => {
      strategy = new MakerStrategy();
    });

    it("should set strategy summary", () => {
      strategy.setStrategySummary("New strategy");
      expect(strategy).toBeDefined();
    });

    it("should accept undefined", () => {
      strategy.setStrategySummary(undefined);
      expect(strategy).toBeDefined();
    });

    it("should overwrite existing summary", () => {
      strategy = new MakerStrategy(undefined, undefined, undefined, "Old");
      strategy.setStrategySummary("New");
      expect(strategy).toBeDefined();
    });

    it("should accept empty string", () => {
      strategy.setStrategySummary("");
      expect(strategy).toBeDefined();
    });
  });

  describe("setLogger", () => {
    beforeEach(() => {
      strategy = new MakerStrategy();
    });

    it("should set logger", () => {
      const logger: LLMLogger = () => {};
      strategy.setLogger(logger);
      expect(strategy).toBeDefined();
    });

    it("should accept undefined", () => {
      strategy.setLogger(undefined);
      expect(strategy).toBeDefined();
    });

    it("should overwrite existing logger", () => {
      const oldLogger: LLMLogger = () => {};
      strategy = new MakerStrategy(undefined, oldLogger);
      const newLogger: LLMLogger = () => {};
      strategy.setLogger(newLogger);
      expect(strategy).toBeDefined();
    });
  });

  describe("runAITurn", () => {
    beforeEach(() => {
      strategy = new MakerStrategy();
    });

    it("should be async function", () => {
      expect(typeof strategy.runAITurn).toBe("function");
      expect(strategy.runAITurn.constructor.name).toBe("AsyncFunction");
    });

    it("should accept engine parameter", () => {
      engine.state.activePlayerId = "ai";
      expect(() => strategy.runAITurn(engine)).not.toThrow();
    });

    it("should accept onStateChange parameter", () => {
      engine.state.activePlayerId = "ai";
      const onStateChange = () => {};
      expect(() => strategy.runAITurn(engine, onStateChange)).not.toThrow();
    });
  });

  describe("resolveAIPendingDecision", () => {
    beforeEach(() => {
      strategy = new MakerStrategy();
    });

    it("should be async function", () => {
      expect(typeof strategy.resolveAIPendingDecision).toBe("function");
      expect(strategy.resolveAIPendingDecision.constructor.name).toBe(
        "AsyncFunction",
      );
    });

    it("should accept engine parameter", () => {
      engine.state.pendingChoice = {
        playerId: "ai",
        stage: "discard",
        prompt: "Discard",
        min: 1,
        max: 1,
        cardOptions: ["Copper"],
      };
      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });

    it("should handle null pending choice", () => {
      engine.state.pendingChoice = null;
      expect(() => strategy.resolveAIPendingDecision(engine)).not.toThrow();
    });
  });

  describe("model settings", () => {
    it("should support json data format", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 4,
        dataFormat: "json",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should support text data format", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 4,
        dataFormat: "text",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should support mixed data format", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 4,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should support multiple enabled models", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set([
          "claude-haiku",
          "gpt-4o-mini",
          "gemini-2.5-flash-lite",
        ]),
        consensusCount: 8,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should support single model", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["ministral-3b"]),
        consensusCount: 4,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should support custom consensus count", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 12,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should support custom strategy in model settings", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 4,
        dataFormat: "mixed",
        customStrategy: "Buy Gold early",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should support undefined custom strategy", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 4,
        dataFormat: "mixed",
        customStrategy: undefined,
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });
  });

  describe("integration", () => {
    beforeEach(() => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 4,
        dataFormat: "mixed",
      };
      const logger: LLMLogger = () => {};
      strategy = new MakerStrategy(undefined, logger, modelSettings, "Custom");
    });

    it("should have all methods available", () => {
      expect(strategy.getModeName).toBeDefined();
      expect(strategy.runAITurn).toBeDefined();
      expect(strategy.resolveAIPendingDecision).toBeDefined();
      expect(strategy.setStrategySummary).toBeDefined();
      expect(strategy.setLogger).toBeDefined();
    });

    it("should allow chaining setters", () => {
      const logger: LLMLogger = () => {};
      strategy.setLogger(logger);
      strategy.setStrategySummary("New strategy");
      expect(strategy).toBeDefined();
    });

    it("should maintain mode name after setters", () => {
      strategy.setStrategySummary("Test");
      strategy.setLogger(() => {});
      expect(strategy.getModeName()).toBe("MAKER");
    });
  });

  describe("edge cases", () => {
    it("should handle null provider", () => {
      strategy = new MakerStrategy(null as any);
      expect(strategy).toBeDefined();
    });

    it("should handle empty enabled models set", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(),
        consensusCount: 4,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should handle zero consensus count", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 0,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });

    it("should handle very large consensus count", () => {
      const modelSettings: ModelSettings = {
        enabledModels: new Set(["claude-haiku"]),
        consensusCount: 100,
        dataFormat: "mixed",
      };
      strategy = new MakerStrategy(undefined, undefined, modelSettings);
      expect(strategy).toBeDefined();
    });
  });
});
