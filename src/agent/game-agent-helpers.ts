/**
 * Helper functions for game agent operations
 */

import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { Action, WeightedVote } from "../types/action";
import type { DominionEngine } from "../engine";
import type { CommandResult } from "../commands/types";
import type { ModelProvider } from "../config/models";
import { api } from "../api/client";
import { agentLogger } from "../lib/logger";
import { isDecisionChoice } from "../types/pending-choice";

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
): Promise<{ action: Action; distribution: WeightedVote[] }> {
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
      ...(actionId !== undefined && { actionId }),
      ...(humanChoice !== undefined ? { humanChoice } : {}),
      ...(strategySummary !== undefined && { strategySummary }),
      ...(customStrategy !== undefined && { customStrategy }),
    },
    {
      fetch: { ...(signal !== undefined && { signal }) },
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
    distribution: data.distribution ?? [{ action: data.action, weight: 1 }],
  };
}

type VerifyParams = {
  currentState: GameState;
  action: Action;
  actionId: string;
  customStrategy?: string | undefined;
  logger?:
    | ((entry: {
        type: "consensus-verdict";
        message: string;
        data: Record<string, unknown>;
      }) => void)
    | undefined;
};

/**
 * Ask the evaluation model for a second opinion on the winner. Fire and
 * forget: the verdict is logged against the decision's actionId and never
 * delays execution.
 */
export function verifyConsensusWinner(params: VerifyParams): void {
  const { currentState, action, actionId, customStrategy, logger } = params;
  if (!logger) return;
  void api.api["verify-action"]
    .post({
      currentState,
      action,
      ...(customStrategy !== undefined && { customStrategy }),
    })
    .then(({ data, error }) => {
      if (error || !data || typeof data.blunder !== "number") {
        agentLogger.warn(
          `verify-action skipped: ${error?.value ?? "no verdict"}`,
        );
        return;
      }
      logger({
        type: "consensus-verdict",
        message: `Jev check: blunder risk ${Math.round(data.blunder * 100)}%`,
        data: {
          actionId,
          blunder: data.blunder,
          ...(data.followsOverride !== undefined && {
            followsOverride: data.followsOverride,
          }),
        },
      });
    });
}

/**
 * Execute an action by dispatching the matching command to the engine.
 * play_action doubles as the answer to a "play" decision (Throne Room, Vassal).
 */
export function executeActionWithEngine(
  engine: DominionEngine,
  action: Action,
  playerId: PlayerId,
): CommandResult {
  switch (action.type) {
    case "play_action":
      if (!action.card) throw new Error("play_action requires card");
      if (isDecisionChoice(engine.state.pendingChoice)) {
        return engine.dispatch(
          {
            type: "SUBMIT_DECISION",
            playerId,
            choice: { selectedCards: [action.card] },
          },
          playerId,
        );
      }
      return engine.dispatch(
        { type: "PLAY_ACTION", playerId, card: action.card },
        playerId,
      );
    case "play_treasure":
      if (!action.card) throw new Error("play_treasure requires card");
      return engine.dispatch(
        { type: "PLAY_TREASURE", playerId, card: action.card },
        playerId,
      );
    case "buy_card":
      if (!action.card) throw new Error("buy_card requires card");
      return engine.dispatch(
        { type: "BUY_CARD", playerId, card: action.card },
        playerId,
      );
    case "reveal_reaction":
      if (!action.card) throw new Error("reveal_reaction requires card");
      return engine.dispatch(
        { type: "REVEAL_REACTION", playerId, card: action.card },
        playerId,
      );
    case "decline_reaction":
      return engine.dispatch({ type: "DECLINE_REACTION", playerId }, playerId);
    case "skip_decision":
      return engine.dispatch({ type: "SKIP_DECISION", playerId }, playerId);
    case "end_phase":
      return engine.dispatch({ type: "END_PHASE", playerId }, playerId);
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
      );
    default:
      return {
        ok: false,
        error: `Unknown action type: ${String(action.type)}`,
      };
  }
}
