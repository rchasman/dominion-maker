import type { GameStrategy } from "../types/game-mode";
import type { GameState, CardName } from "../types/game-state";
import { advanceGameStateWithConsensus, runAITurnWithConsensus, buildModelsFromSettings, type LLMLogger, type ModelSettings } from "../agent/game-agent";

/**
 * LLM Strategy: Uses model consensus for ALL moves (human and AI)
 * Every atomic step is driven by MAKER consensus - no game engine
 */
export class LLMStrategy implements GameStrategy {
  private logger?: LLMLogger;
  private modelSettings: ModelSettings;

  constructor(_provider?: unknown, logger?: LLMLogger, modelSettings?: ModelSettings) {
    // _provider param deprecated - now uses model settings
    this.logger = logger;
    this.modelSettings = modelSettings || { enabledModels: new Set(["claude-haiku", "gpt-4o-mini", "gemini-2.5-flash-lite", "ministral-3b"]), consensusCount: 8 };
  }

  async handleCardPlay(state: GameState, card: CardName): Promise<GameState> {
    const models = buildModelsFromSettings(this.modelSettings);
    return advanceGameStateWithConsensus(state, { selectedCards: [card] }, models, this.logger);
  }

  async handleBuyCard(state: GameState, card: CardName): Promise<GameState> {
    const models = buildModelsFromSettings(this.modelSettings);
    return advanceGameStateWithConsensus(state, { selectedCards: [card] }, models, this.logger);
  }

  async handlePlayAllTreasures(state: GameState): Promise<GameState> {
    // Get all treasures from hand and pass them as a batch
    const player = state.players[state.activePlayer];
    const treasures = player.hand.filter((card) => {
      return card === "Copper" || card === "Silver" || card === "Gold";
    });

    if (treasures.length === 0) {
      return state;
    }

    const models = buildModelsFromSettings(this.modelSettings);
    return advanceGameStateWithConsensus(state, { selectedCards: treasures }, models, this.logger);
  }

  async handleUnplayTreasure(state: GameState, card: CardName): Promise<GameState> {
    const models = buildModelsFromSettings(this.modelSettings);
    return advanceGameStateWithConsensus(state, { selectedCards: [card] }, models, this.logger);
  }

  async handleEndPhase(state: GameState): Promise<GameState> {
    const models = buildModelsFromSettings(this.modelSettings);
    return advanceGameStateWithConsensus(state, undefined, models, this.logger);
  }

  async runAITurn(state: GameState): Promise<GameState> {
    const models = buildModelsFromSettings(this.modelSettings);
    return runAITurnWithConsensus(state, models, this.logger);
  }

  getModeName(): string {
    return "LLM Agent (MAKER Consensus)";
  }
}
