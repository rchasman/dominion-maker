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
import { moveToCommand } from "../dominion/move-to-command";

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

/** Dispatch the command a legal move maps to */
export function executeActionWithEngine(
  engine: DominionEngine,
  action: Action,
  playerId: PlayerId,
): CommandResult {
  return engine.dispatch(
    moveToCommand(engine.state, action, playerId),
    playerId,
  );
}
