/**
 * Helper functions for game agent operations
 */

import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { Action } from "../types/action";
import type { DominionEngine } from "../engine";
import type { ModelProvider } from "../config/models";
import { api } from "../api/client";
import { agentLogger } from "../lib/logger";

type GenerateActionParams = {
  provider: ModelProvider;
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  signal?: AbortSignal;
  strategySummary?: string;
  customStrategy?: string;
  actionId?: string; // For grouping consensus votes in devtools
};

/**
 * Call backend API to generate action
 */
export async function generateActionViaBackend(
  params: GenerateActionParams,
): Promise<{ action: Action }> {
  const {
    provider,
    currentState,
    humanChoice,
    signal,
    strategySummary,
    customStrategy,
    actionId,
  } = params;

  // The backend derives legal actions from currentState itself
  const { data, error } = await api.api["generate-action"].post(
    {
      provider,
      currentState,
      ...(humanChoice !== undefined ? { humanChoice } : {}),
      ...(strategySummary !== undefined && { strategySummary }),
      ...(customStrategy !== undefined && { customStrategy }),
    },
    {
      fetch: { ...(signal !== undefined && { signal }) },
    },
  );
  void actionId; // Used for logging/tracking, not sent to API

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
  };
}

/**
 * Execute an action by dispatching command to engine
 * This replaces the old executeAction that mutated state
 */
export function executeActionWithEngine(
  engine: DominionEngine,
  action: Action,
  playerId: PlayerId,
): boolean {
  switch (action.type) {
    case "play_action":
      if (!action.card) throw new Error("play_action requires card");
      return engine.dispatch(
        { type: "PLAY_ACTION", playerId, card: action.card },
        playerId,
      ).ok;
    case "play_treasure":
      if (!action.card) throw new Error("play_treasure requires card");
      return engine.dispatch(
        { type: "PLAY_TREASURE", playerId, card: action.card },
        playerId,
      ).ok;
    case "buy_card":
      if (!action.card) throw new Error("buy_card requires card");
      return engine.dispatch(
        { type: "BUY_CARD", playerId, card: action.card },
        playerId,
      ).ok;
    case "reveal_reaction":
      if (!action.card) throw new Error("reveal_reaction requires card");
      return engine.dispatch(
        { type: "REVEAL_REACTION", playerId, card: action.card },
        playerId,
      ).ok;
    case "decline_reaction":
      return engine.dispatch({ type: "DECLINE_REACTION", playerId }, playerId)
        .ok;
    case "skip_decision":
      return engine.dispatch({ type: "SKIP_DECISION", playerId }, playerId).ok;
    case "end_phase":
      return engine.dispatch({ type: "END_PHASE", playerId }, playerId).ok;
    case "discard_card":
    case "trash_card":
    case "topdeck_card":
    case "gain_card":
      // Multi-action decisions are handled by multi-round consensus
      // This path is only for simple single-card decisions
      if (!action.card) throw new Error(`${action.type} requires card`);
      return engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          playerId,
          choice: { selectedCards: [action.card] },
        },
        playerId,
      ).ok;
    default:
      agentLogger.error(`Unknown action type: ${String(action.type)}`);
      return false;
  }
}
