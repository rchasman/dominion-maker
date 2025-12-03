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

    this.logger?.({
      type: "ai-decision-resolving" as any,
      message: `AI resolving ${decision.type} decision`,
      data: { decisionType: decision.type, prompt: decision.prompt, optionsCount: decision.options.length },
    });

    // Use LLM consensus to generate discard_cards/trash_cards/gain_card action
    // The LLMs will vote on which cards to select from the options
    const models = buildModelsFromSettings(this.modelSettings);
    const newState = await advanceGameStateWithConsensus(state, undefined, models, this.logger);

    // If there's still a pending decision (multi-card discard), recursively resolve
    if (newState.pendingDecision && newState.pendingDecision.player === "ai") {
      this.logger?.({
        type: "ai-decision-continuing" as any,
        message: `AI decision continues (multi-select)`,
        data: { remaining: newState.pendingDecision.metadata?.totalNeeded },
      });
      return this.resolveAIPendingDecision(newState);
    }

    // Decision fully resolved - subPhase cleared by card effect
    this.logger?.({
      type: "ai-decision-resolved" as any,
      message: `AI decision fully resolved`,
      data: { decisionType: decision.type },
    });
    return newState;
  }

  getModeName(): string {
    return "LLM Agent (MAKER Consensus)";
  }
}
