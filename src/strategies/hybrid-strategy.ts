import type { GameStrategy } from "../types/game-mode";
import type { GameState, CardName } from "../types/game-state";
import { runAITurnWithConsensus, ALL_FAST_MODELS, type LLMLogger } from "../agent/game-agent";
import {
  playAction,
  playTreasure,
  playAllTreasures,
  unplayTreasure,
  buyCard,
  endActionPhase,
  endBuyPhase,
  resolveDecision,
} from "../lib/game-engine";
import { isActionCard, isTreasureCard } from "../data/cards";

/**
 * Hybrid Strategy: Uses hard-coded engine for human moves,
 * but delegates to 10-model consensus for AI turns with full validation
 */
export class HybridStrategy implements GameStrategy {
  private logger?: LLMLogger;

  constructor(_provider?: unknown, logger?: LLMLogger) {
    // _provider param deprecated - now uses all 10 fast models
    this.logger = logger;
  }

  async handleCardPlay(state: GameState, card: CardName): Promise<GameState> {
    // Use engine logic for human moves
    if (state.pendingDecision && state.pendingDecision.options.includes(card)) {
      return resolveDecision(state, [card]);
    }

    const { phase, actions } = state;

    if (phase === "action" && isActionCard(card) && actions > 0) {
      return playAction(state, card);
    }

    if (phase === "buy" && isTreasureCard(card)) {
      return playTreasure(state, card);
    }

    return state;
  }

  async handleBuyCard(state: GameState, card: CardName): Promise<GameState> {
    // Use engine logic for human moves
    if (state.pendingDecision && state.pendingDecision.type === "gain" && state.pendingDecision.options.includes(card)) {
      return resolveDecision(state, [card]);
    }

    if (state.phase !== "buy" || state.buys < 1) {
      return state;
    }
    return buyCard(state, card);
  }

  async handlePlayAllTreasures(state: GameState): Promise<GameState> {
    // Use engine logic for human moves
    if (state.phase !== "buy") {
      return state;
    }
    return playAllTreasures(state);
  }

  async handleUnplayTreasure(state: GameState, card: CardName): Promise<GameState> {
    // Use engine logic for human moves
    if (state.phase !== "buy") {
      return state;
    }
    return unplayTreasure(state, card);
  }

  async handleEndPhase(state: GameState): Promise<GameState> {
    // Use engine logic for human moves
    if (state.pendingDecision && state.pendingDecision.canSkip) {
      return resolveDecision(state, []);
    }

    if (state.phase === "action") {
      return endActionPhase(state);
    } else if (state.phase === "buy") {
      return endBuyPhase(state);
    }
    return state;
  }

  async runAITurn(state: GameState): Promise<GameState> {
    // Use 10-model consensus for AI turns with validation
    return runAITurnWithConsensus(state, ALL_FAST_MODELS, this.logger);
  }

  getModeName(): string {
    return "Hybrid (Engine + MAKER Consensus)";
  }
}
