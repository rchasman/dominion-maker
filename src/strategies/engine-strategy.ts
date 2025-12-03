import type { GameStrategy } from "../types/game-mode";
import type { GameState, CardName } from "../types/game-state";
import {
  playAction,
  playTreasure,
  playAllTreasures,
  unplayTreasure,
  buyCard,
  endActionPhase,
  endBuyPhase,
  runSimpleAITurn,
  resolveDecision,
} from "../lib/game-engine";
import { isActionCard, isTreasureCard } from "../data/cards";

export class EngineStrategy implements GameStrategy {
  async handleCardPlay(state: GameState, card: CardName): Promise<GameState> {
    // If there's a pending decision, this is resolving it
    if (state.pendingDecision) {
      // Check if this is a valid option (could be card name or text option)
      if (state.pendingDecision.options.includes(card)) {
        return resolveDecision(state, [card]);
      }

      // For choose_card_from_options with text choices, card parameter is the text choice
      if (state.pendingDecision.type === "choose_card_from_options") {
        // The "card" parameter is actually the text choice (e.g., "Trash", "Keep")
        return resolveDecision(state, [card]);
      }
    }

    const { phase, actions } = state;

    // Action phase: play action cards
    if (phase === "action" && isActionCard(card) && actions > 0) {
      return playAction(state, card);
    }

    // Buy phase: play treasures
    if (phase === "buy" && isTreasureCard(card)) {
      return playTreasure(state, card);
    }

    return state;
  }

  async handleBuyCard(state: GameState, card: CardName): Promise<GameState> {
    // If there's a pending decision for gaining, this resolves it
    if (state.pendingDecision && state.pendingDecision.type === "gain" && state.pendingDecision.options.includes(card)) {
      return resolveDecision(state, [card]);
    }

    if (state.phase !== "buy" || state.buys < 1) {
      return state;
    }
    return buyCard(state, card);
  }

  async handlePlayAllTreasures(state: GameState): Promise<GameState> {
    if (state.phase !== "buy") {
      return state;
    }
    return playAllTreasures(state);
  }

  async handleUnplayTreasure(state: GameState, card: CardName): Promise<GameState> {
    if (state.phase !== "buy") {
      return state;
    }
    return unplayTreasure(state, card);
  }

  async handleEndPhase(state: GameState): Promise<GameState> {
    // If there's a skippable pending decision, resolve it with empty selection
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
    return runSimpleAITurn(state);
  }

  getModeName(): string {
    return "Hard-coded Engine";
  }
}
