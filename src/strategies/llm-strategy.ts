import type { GameStrategy } from "../types/game-mode";
import type { GameState, CardName } from "../types/game-state";
import { advanceGameStateWithConsensus, runAITurnWithConsensus, ALL_FAST_MODELS, type LLMLogger } from "../agent/game-agent";

/**
 * LLM Strategy: Uses 10-model consensus for ALL moves (human and AI)
 * Every atomic step is driven by MAKER consensus - no game engine
 */
export class LLMStrategy implements GameStrategy {
  private logger?: LLMLogger;

  constructor(_provider?: unknown, logger?: LLMLogger) {
    // _provider param deprecated - now uses all 10 fast models
    this.logger = logger;
  }

  async handleCardPlay(state: GameState, card: CardName): Promise<GameState> {
    return advanceGameStateWithConsensus(state, { selectedCards: [card] }, ALL_FAST_MODELS, this.logger);
  }

  async handleBuyCard(state: GameState, card: CardName): Promise<GameState> {
    return advanceGameStateWithConsensus(state, { selectedCards: [card] }, ALL_FAST_MODELS, this.logger);
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

    return advanceGameStateWithConsensus(state, { selectedCards: treasures }, ALL_FAST_MODELS, this.logger);
  }

  async handleUnplayTreasure(state: GameState, card: CardName): Promise<GameState> {
    return advanceGameStateWithConsensus(state, { selectedCards: [card] }, ALL_FAST_MODELS, this.logger);
  }

  async handleEndPhase(state: GameState): Promise<GameState> {
    return advanceGameStateWithConsensus(state, undefined, ALL_FAST_MODELS, this.logger);
  }

  async runAITurn(state: GameState): Promise<GameState> {
    return runAITurnWithConsensus(state, ALL_FAST_MODELS, this.logger);
  }

  getModeName(): string {
    return "LLM Agent (MAKER Consensus)";
  }
}
