/**
 * MAKER Strategy - Multi-model consensus for AI turns
 */

import type { GameStrategy } from "../types/game-mode";
import type { DominionEngine } from "../engine";
import type { GameState } from "../types/game-state";
import {
  runAITurnWithConsensus,
  advanceGameStateWithConsensus,
  buildModelsFromSettings,
  type LLMLogger,
  type ModelSettings,
} from "../agent/game-agent";

/**
 * MAKER: Uses multi-model consensus voting for AI turns
 */
export class MakerStrategy implements GameStrategy {
  private logger?: LLMLogger;
  private modelSettings: ModelSettings;
  private strategySummary?: string;

  constructor(
    _provider?: unknown,
    logger?: LLMLogger,
    modelSettings?: ModelSettings,
    strategySummary?: string,
  ) {
    this.logger = logger;
    this.modelSettings = modelSettings || {
      enabledModels: new Set([
        "claude-haiku",
        "gpt-4o-mini",
        "gemini-2.5-flash-lite",
        "ministral-3b",
      ]),
      consensusCount: 8,
      dataFormat: "mixed",
    };
    this.strategySummary = strategySummary;
  }

  setStrategySummary(summary: string | undefined): void {
    this.strategySummary = summary;
  }

  setLogger(logger: LLMLogger | undefined): void {
    this.logger = logger;
  }

  async runAITurn(
    engine: DominionEngine,
    onStateChange?: (state: GameState) => void,
  ): Promise<void> {
    // Use LLM consensus for strategic decisions
    const models = buildModelsFromSettings(this.modelSettings);
    // Use the actual active player (could be "ai", "ai1", or "ai2")
    const activePlayer = engine.state.activePlayer;
    return runAITurnWithConsensus(engine, activePlayer, {
      providers: models,
      logger: this.logger,
      onStateChange,
      strategySummary: this.strategySummary,
      customStrategy: this.modelSettings.customStrategy,
      dataFormat: this.modelSettings.dataFormat,
    });
  }

  async resolveAIPendingDecision(engine: DominionEngine): Promise<void> {
    // Use LLM consensus for decisions
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

    // Use the actual pending decision player (could be "ai", "ai1", or "ai2")
    const player = pendingDecision?.player || engine.state.activePlayer;
    return advanceGameStateWithConsensus(engine, player, {
      providers: models,
      logger: this.logger,
      strategySummary: this.strategySummary,
      customStrategy: this.modelSettings.customStrategy,
      dataFormat: this.modelSettings.dataFormat,
    });
  }

  getModeName(): string {
    return "MAKER";
  }
}
