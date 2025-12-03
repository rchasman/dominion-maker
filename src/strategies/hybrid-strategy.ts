import type { GameStrategy } from "../types/game-mode";
import type { GameState, CardName } from "../types/game-state";
import { runAITurnWithConsensus, advanceGameStateWithConsensus, buildModelsFromSettings, type LLMLogger, type ModelSettings } from "../agent/game-agent";
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
 * but delegates to model consensus for AI turns with full validation
 */
export class HybridStrategy implements GameStrategy {
  private logger?: LLMLogger;
  private modelSettings: ModelSettings;

  constructor(_provider?: unknown, logger?: LLMLogger, modelSettings?: ModelSettings) {
    // _provider param deprecated - now uses model settings
    this.logger = logger;
    this.modelSettings = modelSettings || { enabledModels: new Set(["claude-haiku", "gpt-4o-mini", "gemini-2.5-flash-lite", "ministral-3b"]), consensusCount: 8 };
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

  async runAITurn(state: GameState, onStateChange?: (state: GameState) => void): Promise<GameState> {
    // Use model consensus for AI turns with validation
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
    return "Hybrid (Engine + MAKER Consensus)";
  }
}
