/**
 * Consensus system helpers for multi-model voting and execution
 */

import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { Action } from "../types/action";
import { stripReasoning } from "../types/action";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelProvider } from "../config/models";
import { isActionCard, isTreasureCard } from "../data/cards";
import { formatActionDescription } from "../lib/action-utils";
import { run } from "../lib/run";
import { agentLogger } from "../lib/logger";

// Logger type for capturing LLM activity
export type LLMLogger = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => void;

// Constants
export const MODEL_TIMEOUT_MS = 5000;
export const PERCENTAGE_MULTIPLIER = 100;

// Types for consensus voting system
export type ModelResult = {
  provider: ModelProvider;
  result: Action | null;
  error: unknown;
  duration: number;
  format: "json" | "toon";
};

export type ActionSignature = string;

export type VoteGroup = {
  signature: ActionSignature;
  action: Action;
  voters: ModelProvider[];
  count: number;
};

export type ModelHandlerParams = {
  provider: ModelProvider;
  index: number;
  modelStart: number;
  logger?: LLMLogger;
};

export type ModelExecutionContext = {
  provider: ModelProvider;
  index: number;
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  strategySummary?: string;
  customStrategy?: string;
  format: "json" | "toon";
  actionId: string;
  abortController: AbortController;
  voteGroups: Map<ActionSignature, VoteGroup>;
  completedResultsMap: Map<number, ModelResult>;
  aheadByK: number;
  logger?: LLMLogger;
  pendingModels: Set<number>;
  modelStartTimes: Map<number, number>;
  providers: ModelProvider[];
  onEarlyConsensus: (winner: VoteGroup) => void;
  onComplete: () => void;
};

export type ConsensusWinnerResult = {
  winner: VoteGroup;
  votesConsidered: number;
  validEarlyConsensus: boolean;
  rankedGroups: VoteGroup[];
};

export type ConsensusStartParams = {
  currentState: GameState;
  playerId: PlayerId;
  providers: ModelProvider[];
  legalActions: Action[];
  logger?: LLMLogger;
};

export type VotingResultsParams = {
  winner: VoteGroup;
  votesConsidered: number;
  validEarlyConsensus: boolean;
  rankedGroups: VoteGroup[];
  aheadByK: number;
  completedResults: ModelResult[];
  legalActions: Action[];
  overallStart: number;
  currentState: GameState;
  playerState: GameState["players"][string] | undefined;
  hand: CardName[];
  inPlay: CardName[];
  handCounts: { treasures: number; actions: number; total: number };
  logger?: LLMLogger;
};

// Helper to create action signature for voting
export const createActionSignature = (action: Action): ActionSignature => {
  return JSON.stringify(stripReasoning(action));
};

// Check if we have early consensus (leader ahead by K votes)
export const checkEarlyConsensus = (
  voteGroups: Map<ActionSignature, VoteGroup>,
  aheadByK: number,
): VoteGroup | null => {
  const groups = Array.from(voteGroups.values()).sort(
    (a, b) => b.count - a.count,
  );
  if (groups.length === 0) return null;

  const leader = groups[0]!;
  const runnerUp = groups[1]?.count ?? 0;

  if (leader.count - runnerUp >= aheadByK) {
    return leader;
  }
  return null;
};

// Handle successful model response
export const handleModelSuccess = (
  action: Action,
  format: "json" | "toon",
  params: ModelHandlerParams,
): ModelResult => {
  const { provider, index, modelStart, logger } = params;
  const modelDuration = performance.now() - modelStart;
  logger?.({
    type: "consensus-model-complete",
    message: `${provider} completed in ${modelDuration.toFixed(0)}ms`,
    data: {
      provider,
      index,
      duration: modelDuration,
      action,
      success: true,
      format,
    },
  });
  return {
    provider,
    result: action,
    error: null,
    duration: modelDuration,
    format,
  };
};

// Handle model error
export const handleModelError = (
  error: unknown,
  params: ModelHandlerParams,
): ModelResult => {
  const { provider, index, modelStart, logger } = params;
  const modelDuration = performance.now() - modelStart;
  const errorObj = error as { name?: string; message?: string };
  const isAborted =
    errorObj.name === "AbortError" || errorObj.message?.includes("abort");
  const isTimeout = modelDuration >= MODEL_TIMEOUT_MS;

  logger?.({
    type: "consensus-model-complete",
    message: run(() => {
      if (isTimeout) {
        return `${provider} timed out after ${modelDuration.toFixed(0)}ms`;
      }
      if (isAborted) {
        return `${provider} aborted after ${modelDuration.toFixed(0)}ms`;
      }
      return `${provider} failed after ${modelDuration.toFixed(0)}ms`;
    }),
    data: {
      provider,
      index,
      duration: modelDuration,
      error: String(error),
      success: false,
      aborted: isAborted,
      timeout: isTimeout,
    },
  });
  return {
    provider,
    result: null,
    error: errorObj,
    duration: modelDuration,
    format: "toon",
  };
};

// Handle model result and check for early consensus
export const handleModelResult = (
  modelResult: ModelResult,
  context: Omit<ModelExecutionContext, "provider" | "index">,
): void => {
  const {
    voteGroups,
    aheadByK,
    abortController,
    pendingModels,
    modelStartTimes,
    providers,
    logger,
    onEarlyConsensus,
    onComplete,
  } = context;

  if (modelResult.result) {
    const signature = createActionSignature(modelResult.result);
    const existing = voteGroups.get(signature);
    if (existing) {
      const updatedVoters = [...existing.voters, modelResult.provider];
      voteGroups.set(signature, {
        ...existing,
        voters: updatedVoters,
        count: existing.count + 1,
      });
    } else {
      voteGroups.set(signature, {
        signature,
        action: modelResult.result,
        voters: [modelResult.provider],
        count: 1,
      });
    }

    const winner = checkEarlyConsensus(voteGroups, aheadByK);
    if (winner) {
      abortController.abort();

      const nowTime = Date.now();
      Array.from(pendingModels).map(pendingIndex => {
        const startTime = modelStartTimes.get(pendingIndex) || nowTime;
        return logger?.({
          type: "consensus-model-aborted",
          message: `${providers[pendingIndex]} aborted (early consensus)`,
          data: {
            provider: providers[pendingIndex],
            index: pendingIndex,
            duration: nowTime - startTime,
          },
        });
      });

      onEarlyConsensus(winner);
      return;
    }
  }

  onComplete();
};

// Validate if an action is legal
export const isActionValid = (
  action: Action,
  legalActions: Action[],
): boolean => {
  return legalActions.some(legal => {
    if (legal.type !== action.type) return false;

    // All actions with card field (atomic)
    if (
      action.type === "play_action" ||
      action.type === "play_treasure" ||
      action.type === "buy_card" ||
      action.type === "gain_card" ||
      action.type === "discard_card" ||
      action.type === "trash_card" ||
      action.type === "topdeck_card"
    ) {
      return "card" in legal && legal.card === action.card;
    }

    // Actions without card field
    return action.type === "end_phase" || action.type === "skip_decision";
  });
};

// Select consensus winner from voting results
export const selectConsensusWinner = (
  voteGroups: Map<ActionSignature, VoteGroup>,
  results: ModelResult[],
  earlyConsensus: VoteGroup | null,
  legalActions: Action[],
): ConsensusWinnerResult => {
  const successfulResults = results.filter(r => r.result !== null && !r.error);

  if (!earlyConsensus && successfulResults.length === 0) {
    agentLogger.error("All models failed to generate actions");
    throw new Error("All AI models failed - check connection");
  }

  // Sort by vote count descending, then by signature alphabetically for deterministic tie-breaking
  const rankedGroups = Array.from(voteGroups.values()).sort(
    (a, b) => b.count - a.count || a.signature.localeCompare(b.signature),
  );

  const validRankedGroups = rankedGroups.filter(g =>
    isActionValid(g.action, legalActions),
  );
  const validEarlyConsensus =
    earlyConsensus && isActionValid(earlyConsensus.action, legalActions)
      ? earlyConsensus
      : null;

  if (!validEarlyConsensus && validRankedGroups.length === 0) {
    agentLogger.error("All LLM actions were invalid");
    throw new Error("All AI actions invalid - models may be confused");
  }

  const winner = validEarlyConsensus || validRankedGroups[0];
  const votesConsidered = earlyConsensus
    ? results.length
    : successfulResults.length;

  return {
    winner,
    votesConsidered,
    validEarlyConsensus: !!validEarlyConsensus,
    rankedGroups,
  };
};

// Log voting results
export const logVotingResults = (params: VotingResultsParams): void => {
  const {
    winner,
    votesConsidered,
    validEarlyConsensus,
    rankedGroups,
    aheadByK,
    completedResults,
    legalActions,
    overallStart,
    currentState,
    playerState,
    hand,
    inPlay,
    handCounts,
    logger,
  } = params;

  const consensusStrength = winner.count / votesConsidered;
  const actionDesc = formatActionDescription(winner.action);

  logger?.({
    type: "consensus-voting",
    message: validEarlyConsensus
      ? `⚡ Ahead-by-${aheadByK}: ${actionDesc} (${winner.count} votes)`
      : `◉ Voting: winner ${actionDesc} (${winner.count}/${votesConsidered})`,
    data: {
      topResult: {
        action: winner.action,
        votes: winner.count,
        voters: winner.voters,
        percentage: `${(consensusStrength * PERCENTAGE_MULTIPLIER).toFixed(1)}%`,
        totalVotes: votesConsidered,
        completed: votesConsidered,
        earlyConsensus: validEarlyConsensus,
      },
      allResults: rankedGroups.map(g => ({
        action: g.action,
        votes: g.count,
        voters: g.voters,
        valid: isActionValid(g.action, legalActions),
        reasonings: g.voters.map(voter => {
          const result = completedResults.find(r => {
            if (!r.result) return false;
            return (
              r.provider === voter &&
              JSON.stringify(stripReasoning(r.result)) ===
                JSON.stringify(stripReasoning(g.action))
            );
          });
          return {
            provider: voter,
            reasoning: result?.result?.reasoning,
          };
        }),
      })),
      votingDuration: performance.now() - overallStart,
      currentPhase: currentState.phase,
      gameState: {
        turn: currentState.turn,
        phase: currentState.phase,
        activePlayerId: playerState || {
          hand: [],
          deck: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
        actions: currentState.actions,
        buys: currentState.buys,
        coins: currentState.coins,
        hand,
        inPlay,
        handCounts,
        turnHistory: currentState.turnHistory,
        legalActions: legalActions.map(a => {
          if (a.type === "end_phase") return "end_phase";
          if (a.type === "choose_from_options")
            return `choose[${a.optionIndex}]`;
          return `${a.type}(${a.card})`;
        }),
      },
    },
  });
};

// Log consensus start
export const logConsensusStart = (params: ConsensusStartParams): void => {
  const { currentState, playerId, providers, legalActions, logger } = params;
  const playerState = currentState.players[playerId];
  const hand = playerState?.hand || [];
  const inPlay = playerState?.inPlay || [];
  const handCounts = {
    treasures: hand.filter(isTreasureCard).length,
    actions: hand.filter(isActionCard).length,
    total: hand.length,
  };

  logger?.({
    type: "consensus-start",
    message: `Starting consensus with ${providers.length} models`,
    data: {
      providers,
      totalModels: providers.length,
      phase: currentState.phase,
      legalActionsCount: legalActions.length,
      turn: currentState.turn,
      gameState: {
        turn: currentState.turn,
        phase: currentState.phase,
        activePlayerId: playerState || {
          hand: [],
          deck: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        },
        actions: currentState.actions,
        buys: currentState.buys,
        coins: currentState.coins,
        hand,
        inPlay,
        handCounts,
        turnHistory: currentState.turnHistory,
        legalActionsCount: legalActions.length,
        legalActions: legalActions.map(a => {
          if (a.type === "end_phase") return "end_phase";
          if (a.type === "choose_from_options")
            return `choose[${a.optionIndex}]`;
          return `${a.type}(${a.card})`;
        }),
      },
    },
  });
};
