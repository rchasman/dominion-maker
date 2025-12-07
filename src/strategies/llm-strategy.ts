/**
 * LLM Strategy - Full LLM consensus for all moves using event-sourced DominionEngine
 */

import type { GameStrategy } from "../types/game-mode";
import type { DominionEngine } from "../engine";
import type { GameState } from "../types/game-state";
import { runAITurnWithConsensus, buildModelsFromSettings, type LLMLogger, type ModelSettings } from "../agent/game-agent";

export class LLMStrategy implements GameStrategy {
  private logger?: LLMLogger;
  private modelSettings: ModelSettings;

  constructor(_provider?: unknown, logger?: LLMLogger, modelSettings?: ModelSettings) {
    this.logger = logger;
    this.modelSettings = modelSettings || {
      enabledModels: new Set(["claude-haiku", "gpt-4o-mini", "gemini-2.5-flash-lite", "ministral-3b"]),
      consensusCount: 8
    };
  }

  async runAITurn(engine: DominionEngine, onStateChange?: (state: GameState) => void): Promise<void> {
    const models = buildModelsFromSettings(this.modelSettings);
    return runAITurnWithConsensus(engine, "ai", models, this.logger, onStateChange);
  }

  async resolveAIPendingDecision(engine: DominionEngine): Promise<void> {
    const models = buildModelsFromSettings(this.modelSettings);
    const pendingDecision = engine.state.pendingDecision;

    // Log ai-decision-resolving to create a new "turn" in consensus viewer
    if (pendingDecision) {
      this.logger?.({
        type: "ai-decision-resolving",
        message: `AI resolving ${pendingDecision.type}`,
        data: {
          turn: engine.state.turn,
          decisionType: pendingDecision.type,
          prompt: pendingDecision.prompt,
        },
      });
    }

    // Consensus system handles decisions within runAITurnWithConsensus
    // For standalone decision resolution, run one consensus step
    const { advanceGameStateWithConsensus } = await import("../agent/game-agent");
    return advanceGameStateWithConsensus(engine, "ai", undefined, models, this.logger);
  }

  getModeName(): string {
    return "LLM Consensus";
  }
}
