/**
 * Helper functions for game agent operations
 */

import type { GameState, CardName } from "../types/game-state";
import type { Action } from "../types/action";
import type { DominionEngine } from "../engine";
import type { ModelProvider } from "../config/models";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
import { api } from "../api/client";
import { agentLogger } from "../lib/logger";

/**
 * Get legal actions from current game state for LLM context
 * Adapted to work with event-sourced state
 */
export function getLegalActions(state: GameState): Action[] {
  // Pending decision actions - use decision.player, not activePlayer!
  // (e.g., Militia makes opponent discard while human is still active)
  if (state.pendingDecision) {
    const decision = state.pendingDecision;
    const decisionPlayer = decision.player;
    const playerState = state.players[decisionPlayer];
    if (!playerState) return [];

    const options = decision.cardOptions || [];

    if (decision.stage === "trash") {
      const trashActions = options.map(card => ({
        type: "trash_card" as const,
        card,
      }));
      return decision.canSkip
        ? [...trashActions, { type: "skip_decision" as const }]
        : trashActions;
    }

    if (decision.stage === "discard" || decision.stage === "opponent_discard") {
      const discardActions = options.map(card => ({
        type: "discard_card" as const,
        card,
      }));
      return decision.canSkip
        ? [...discardActions, { type: "skip_decision" as const }]
        : discardActions;
    }

    if (decision.stage === "gain" || decision.from === "supply") {
      const gainActions = options.map(card => ({
        type: "gain_card" as const,
        card,
      }));
      return decision.canSkip
        ? [...gainActions, { type: "skip_decision" as const }]
        : gainActions;
    }

    return [];
  }

  // No pending decision - use active player
  const player = state.activePlayer;
  const playerState = state.players[player];
  if (!playerState) return [];

  // Action phase
  if (state.phase === "action") {
    const actionCards = playerState.hand.filter(isActionCard);
    const playActions =
      state.actions > 0
        ? actionCards.map(card => ({ type: "play_action" as const, card }))
        : [];
    return [...playActions, { type: "end_phase" }];
  }

  // Buy phase
  if (state.phase === "buy") {
    const treasures = playerState.hand.filter(isTreasureCard);
    const playTreasures = treasures.map(card => ({
      type: "play_treasure" as const,
      card,
    }));

    // Buyable cards
    const buyableCards = Object.entries(state.supply)
      .filter(([card, count]) => {
        const cardName = card as CardName;
        return (
          count > 0 && CARDS[cardName]?.cost <= state.coins && state.buys > 0
        );
      })
      .map(([card]) => ({ type: "buy_card" as const, card: card as CardName }));

    return [...playTreasures, ...buyableCards, { type: "end_phase" }];
  }

  return [];
}

type GenerateActionParams = {
  provider: ModelProvider;
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  signal?: AbortSignal;
  strategySummary?: string;
  customStrategy?: string;
  format?: "json" | "toon";
  actionId?: string; // For grouping consensus votes in devtools
};

/**
 * Call backend API to generate action
 */
export async function generateActionViaBackend(
  params: GenerateActionParams,
): Promise<{ action: Action; format: "json" | "toon" }> {
  const {
    provider,
    currentState,
    humanChoice,
    signal,
    strategySummary,
    customStrategy,
    format,
    actionId,
  } = params;

  // SPIKE: AI derives legal actions from rules instead of receiving a list
  const legalActions: Action[] = [];
  // Uncomment to send legal actions (constrains AI to valid moves):
  // const legalActions = getLegalActions(currentState);

  const { data, error } = await api.api["generate-action"].post(
    {
      provider,
      currentState,
      humanChoice,
      legalActions,
      strategySummary,
      customStrategy,
      format,
      actionId,
    },
    {
      fetch: { signal },
    },
  );

  if (error) {
    const errorMsg =
      typeof error === "object" && error && "value" in error
        ? String(error.value)
        : "Backend request failed";
    throw new Error(errorMsg);
  }

  if (!data?.action) {
    throw new Error("Backend returned no action");
  }

  return {
    action: data.action,
    format: data.format || "toon",
  };
}

/**
 * Execute an action by dispatching command to engine
 * This replaces the old executeAction that mutated state
 */
export function executeActionWithEngine(
  engine: DominionEngine,
  action: Action,
  playerId: string,
): boolean {
  switch (action.type) {
    case "play_action":
      if (!action.card) throw new Error("play_action requires card");
      return engine.dispatch(
        { type: "PLAY_ACTION", player: playerId, card: action.card },
        playerId,
      ).ok;
    case "play_treasure":
      if (!action.card) throw new Error("play_treasure requires card");
      return engine.dispatch(
        { type: "PLAY_TREASURE", player: playerId, card: action.card },
        playerId,
      ).ok;
    case "buy_card":
      if (!action.card) throw new Error("buy_card requires card");
      return engine.dispatch(
        { type: "BUY_CARD", player: playerId, card: action.card },
        playerId,
      ).ok;
    case "skip_decision":
      return engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: playerId,
          choice: { selectedCards: [] },
        },
        playerId,
      ).ok;
    case "end_phase":
      return engine.dispatch({ type: "END_PHASE", player: playerId }, playerId)
        .ok;
    case "discard_card":
    case "trash_card":
    case "gain_card":
      // All decision responses are single cards (atomic)
      if (!action.card) throw new Error(`${action.type} requires card`);
      return engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: playerId,
          choice: { selectedCards: [action.card] },
        },
        playerId,
      ).ok;
    default:
      agentLogger.error(`Unknown action type: ${String(action.type)}`);
      return false;
  }
}
