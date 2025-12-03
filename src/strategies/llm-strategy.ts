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

  async runAITurn(state: GameState, onStateChange?: (state: GameState) => void): Promise<GameState> {
    const models = buildModelsFromSettings(this.modelSettings);
    return runAITurnWithConsensus(state, models, this.logger, onStateChange);
  }

  async resolveAIPendingDecision(state: GameState): Promise<GameState> {
    const decision = state.pendingDecision;
    if (!decision || decision.player !== "ai") {
      return state;
    }

    // For now, use hardcoded logic for AI decisions (same as engine mode)
    // TODO: Implement LLM-based decision making for options
    // The current LLM framework generates Actions, not option selections
    const { resolveDecision } = await import("../lib/game-engine");

    // For discard decisions (e.g., Militia attack), use hardcoded priority
    if (decision.type === "discard" && decision.metadata?.cardBeingPlayed === "Militia") {
      const aiPlayer = state.players.ai;
      const priorities = ["Estate", "Duchy", "Province", "Curse", "Copper"];
      let selectedCard: CardName | null = null;

      for (const priority of priorities) {
        if (aiPlayer.hand.includes(priority as CardName)) {
          selectedCard = priority as CardName;
          break;
        }
      }

      if (!selectedCard && aiPlayer.hand.length > 0) {
        selectedCard = aiPlayer.hand[0];
      }

      if (selectedCard) {
        return resolveDecision(state, [selectedCard]);
      }
    }

    // For other AI decisions, skip if possible or pick first option
    if (decision.canSkip) {
      return resolveDecision(state, []);
    } else if (decision.options.length > 0) {
      return resolveDecision(state, [decision.options[0] as CardName]);
    }

    return state;
  }

  getModeName(): string {
    return "LLM Agent (MAKER Consensus)";
  }
}
