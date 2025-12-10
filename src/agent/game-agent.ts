/**
 * LLM Agent - Multi-model consensus system adapted for event-sourced DominionEngine
 */

import type { GameState, CardName } from "../types/game-state";
import type { Action } from "../types/action";
import { stripReasoning } from "../types/action";
import type { LLMLogEntry } from "../components/LLMLog";
import type { DominionEngine } from "../engine";
import type { ModelProvider } from "../config/models";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
import { api } from "../api/client";
import { formatActionDescription } from "../lib/action-utils";
import { run } from "../lib/run";
import {
  AVAILABLE_MODELS,
  ALL_FAST_MODELS,
  DEFAULT_MODEL_SETTINGS,
  buildModelsFromSettings,
  type ModelSettings,
} from "./types";
import { agentLogger } from "../lib/logger";

// Constants
const CONSENSUS_AHEAD_BY_K_MIN = 2;
const CONSENSUS_AHEAD_BY_K_DIVISOR = 3;
const MODEL_TIMEOUT_MS = 5000;
const PERCENTAGE_MULTIPLIER = 100;
const MAX_TURN_STEPS = 20;

// Re-export for convenience
export {
  AVAILABLE_MODELS,
  ALL_FAST_MODELS,
  DEFAULT_MODEL_SETTINGS,
  buildModelsFromSettings,
};
export type { ModelSettings, ModelProvider };

// Global abort controller for canceling ongoing consensus operations
let globalAbortController: AbortController | null = null;

// Abort any ongoing consensus operations (e.g., when starting new game)
export function abortOngoingConsensus() {
  if (globalAbortController) {
    agentLogger.info("Aborting consensus");
    globalAbortController.abort();
    globalAbortController = null;
  }
}

// Logger type for capturing LLM activity
export type LLMLogger = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => void;

// Configuration for consensus operations
type ConsensusConfig = {
  humanChoice?: { selectedCards: CardName[] };
  providers?: ModelProvider[];
  logger?: LLMLogger;
  strategySummary?: string;
};

// Configuration for AI turn operations
type AITurnConfig = {
  providers: ModelProvider[];
  logger?: LLMLogger;
  onStateChange?: (state: GameState) => void;
  strategySummary?: string;
};

// Types for consensus voting system
type ModelResult = {
  provider: ModelProvider;
  result: Action | null;
  error: unknown;
  duration: number;
};
type ActionSignature = string;
type VoteGroup = {
  signature: ActionSignature;
  action: Action;
  voters: ModelProvider[];
  count: number;
};

// Helper to create action signature for voting
const createActionSignature = (action: Action): ActionSignature => {
  return JSON.stringify(stripReasoning(action));
};

// Check if we have early consensus (leader ahead by K votes)
const checkEarlyConsensus = (
  voteGroups: Map<ActionSignature, VoteGroup>,
  aheadByK: number,
): VoteGroup | null => {
  const groups = Array.from(voteGroups.values()).sort(
    (a, b) => b.count - a.count,
  );
  if (groups.length === 0) return null;

  const leader = groups[0];
  const runnerUp = groups[1]?.count ?? 0;

  if (leader.count - runnerUp >= aheadByK) {
    return leader;
  }
  return null;
};

type ModelExecutionContext = {
  provider: ModelProvider;
  index: number;
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  strategySummary?: string;
  abortController: AbortController;
  voteGroups: Map<ActionSignature, VoteGroup>;
  completedResults: ModelResult[];
  aheadByK: number;
  logger?: LLMLogger;
  pendingModels: Set<number>;
  modelStartTimes: Map<number, number>;
  providers: ModelProvider[];
  onEarlyConsensus: (winner: VoteGroup) => void;
  onComplete: () => void;
};

// Handle model result and check for early consensus
const handleModelResult = (
  modelResult: ModelResult,
  context: Omit<ModelExecutionContext, "provider" | "index">,
): void => {
  const {
    voteGroups,
    completedResults,
    aheadByK,
    abortController,
    pendingModels,
    modelStartTimes,
    providers,
    logger,
    onEarlyConsensus,
    onComplete,
  } = context;

  completedResults.push(modelResult);

  if (modelResult.result) {
    const signature = createActionSignature(modelResult.result);
    const existing = voteGroups.get(signature);
    if (existing) {
      existing.voters.push(modelResult.provider);
      existing.count++;
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

type ModelHandlerParams = {
  provider: ModelProvider;
  index: number;
  modelStart: number;
  logger?: LLMLogger;
};

// Handle successful model response
const handleModelSuccess = (
  action: Action,
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
    },
  });
  return {
    provider,
    result: action,
    error: null,
    duration: modelDuration,
  };
};

// Handle model error
const handleModelError = (
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
  return { provider, result: null, error: errorObj, duration: modelDuration };
};

// Execute a single model and handle its result
const executeModel = (context: ModelExecutionContext): void => {
  const {
    provider,
    index,
    currentState,
    humanChoice,
    strategySummary,
    abortController,
    pendingModels,
    modelStartTimes,
    logger,
  } = context;

  const modelStart = performance.now();
  const uiStartTime = Date.now();

  pendingModels.add(index);
  modelStartTimes.set(index, uiStartTime);

  logger?.({
    type: "consensus-model-pending",
    message: `${provider} started`,
    data: { provider, index, startTime: uiStartTime },
  });

  const modelAbortController = new AbortController();
  const timeoutId = setTimeout(() => {
    modelAbortController.abort();
  }, MODEL_TIMEOUT_MS);

  const abortHandler = () => modelAbortController.abort();
  abortController.signal.addEventListener("abort", abortHandler);

  const handlerParams: ModelHandlerParams = { provider, index, modelStart, logger };

  void generateActionViaBackend({
    provider,
    currentState,
    humanChoice,
    signal: modelAbortController.signal,
    strategySummary,
  })
    .then(action => {
      clearTimeout(timeoutId);
      return handleModelSuccess(action, handlerParams);
    })
    .catch(error => {
      clearTimeout(timeoutId);
      return handleModelError(error, handlerParams);
    })
    .finally(() => {
      abortController.signal.removeEventListener("abort", abortHandler);
    })
    .then(modelResult => {
      pendingModels.delete(index);
      handleModelResult(modelResult, context);
    });
};

/**
 * Get legal actions from current game state for LLM context
 * Adapted to work with event-sourced state
 */
function getLegalActions(state: GameState): Action[] {
  const actions: Action[] = [];

  // Pending decision actions - use decision.player, not activePlayer!
  // (e.g., Militia makes opponent discard while human is still active)
  if (state.pendingDecision) {
    const decision = state.pendingDecision;
    const decisionPlayer = decision.player;
    const playerState = state.players[decisionPlayer];
    if (!playerState) return actions;

    const options = decision.cardOptions || [];

    if (decision.stage === "trash") {
      actions.push(
        ...options.map(card => ({ type: "trash_card" as const, card })),
      );
      // Can't skip trashing by selecting nothing - that would be end_phase or a different action
    } else if (
      decision.stage === "discard" ||
      decision.stage === "opponent_discard"
    ) {
      // Single card at a time (atomic)
      actions.push(
        ...options.map(card => ({ type: "discard_card" as const, card })),
      );
      // Can't skip discarding by selecting nothing - that would be end_phase or a different action
    } else if (decision.stage === "gain" || decision.from === "supply") {
      actions.push(
        ...options.map(card => ({ type: "gain_card" as const, card })),
      );
    }
    return actions;
  }

  // No pending decision - use active player
  const player = state.activePlayer;
  const playerState = state.players[player];
  if (!playerState) return actions;

  // Action phase
  if (state.phase === "action") {
    const actionCards = playerState.hand.filter(isActionCard);
    if (state.actions > 0) {
      actions.push(
        ...actionCards.map(card => ({ type: "play_action" as const, card })),
      );
    }
    actions.push({ type: "end_phase" });
  }

  // Buy phase
  if (state.phase === "buy") {
    const treasures = playerState.hand.filter(isTreasureCard);
    actions.push(
      ...treasures.map(card => ({ type: "play_treasure" as const, card })),
    );

    // Buyable cards
    const buyableCards = Object.entries(state.supply)
      .filter(([card, count]) => {
        const cardName = card as CardName;
        return (
          count > 0 && CARDS[cardName]?.cost <= state.coins && state.buys > 0
        );
      })
      .map(([card]) => ({ type: "buy_card" as const, card: card as CardName }));
    actions.push(...buyableCards);

    actions.push({ type: "end_phase" });
  }

  return actions;
}

type GenerateActionParams = {
  provider: ModelProvider;
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  signal?: AbortSignal;
  strategySummary?: string;
};

// Call backend API to generate action
async function generateActionViaBackend(
  params: GenerateActionParams,
): Promise<Action> {
  const { provider, currentState, humanChoice, signal, strategySummary } =
    params;
  const legalActions = getLegalActions(currentState);

  const { data, error } = await api.api["generate-action"].post(
    {
      provider,
      currentState,
      humanChoice,
      legalActions,
      strategySummary,
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

  return data.action;
}

/**
 * Execute an action by dispatching command to engine
 * This replaces the old executeAction that mutated state
 */
function executeActionWithEngine(
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

// Validate if an action is legal
const isActionValid = (action: Action, legalActions: Action[]): boolean => {
  return legalActions.some(legal => {
    if (legal.type !== action.type) return false;

    // All actions with card field (atomic)
    if (
      action.type === "play_action" ||
      action.type === "play_treasure" ||
      action.type === "buy_card" ||
      action.type === "gain_card" ||
      action.type === "discard_card" ||
      action.type === "trash_card"
    ) {
      return "card" in legal && legal.card === action.card;
    }

    // end_phase has no card
    return action.type === "end_phase";
  });
};

type ConsensusWinnerResult = {
  winner: VoteGroup;
  votesConsidered: number;
  validEarlyConsensus: boolean;
  rankedGroups: VoteGroup[];
};

// Select consensus winner from voting results
const selectConsensusWinner = (
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

  const rankedGroups = Array.from(voteGroups.values()).sort(
    (a, b) => b.count - a.count,
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

type ConsensusStartParams = {
  currentState: GameState;
  playerId: string;
  providers: ModelProvider[];
  legalActions: Action[];
  logger?: LLMLogger;
};

type VotingResultsParams = {
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

type RunModelsParams = {
  providers: ModelProvider[];
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  strategySummary?: string;
  logger?: LLMLogger;
  aheadByK: number;
};

type RunModelsResult = {
  results: ModelResult[];
  earlyConsensus: VoteGroup | null;
  voteGroups: Map<ActionSignature, VoteGroup>;
  completedResults: ModelResult[];
};

// Run all models in parallel with early consensus detection
const runModelsInParallel = async (
  params: RunModelsParams,
): Promise<RunModelsResult> => {
  const {
    providers,
    currentState,
    humanChoice,
    strategySummary,
    logger,
    aheadByK,
  } = params;

  const voteGroups = new Map<ActionSignature, VoteGroup>();
  const completedResults: ModelResult[] = [];
  const totalModels = providers.length;
  const pendingModels = new Set<number>();
  const modelStartTimes = new Map<number, number>();

  globalAbortController = new AbortController();
  const abortController = globalAbortController;

  const { results, earlyConsensus } = await new Promise<{
    results: ModelResult[];
    earlyConsensus: VoteGroup | null;
  }>(resolveAll => {
    let resolved = false;
    let completedCount = 0;

    providers.map((provider, index) =>
      executeModel({
        provider,
        index,
        currentState,
        humanChoice,
        strategySummary,
        abortController,
        voteGroups,
        completedResults,
        aheadByK,
        logger,
        pendingModels,
        modelStartTimes,
        providers,
        onEarlyConsensus: (winner: VoteGroup) => {
          if (resolved) return;
          resolved = true;
          resolveAll({ results: completedResults, earlyConsensus: winner });
        },
        onComplete: () => {
          if (resolved) return;
          completedCount++;
          if (completedCount === totalModels) {
            resolveAll({ results: completedResults, earlyConsensus: null });
          }
        },
      }),
    );
  });

  if (globalAbortController === abortController) {
    globalAbortController = null;
  }

  return { results, earlyConsensus, voteGroups, completedResults };
};

// Log voting results
const logVotingResults = (params: VotingResultsParams): void => {
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
        activePlayer: playerState || {
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
      },
    },
  });
};

// Log consensus start
const logConsensusStart = (params: ConsensusStartParams): void => {
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
        activePlayer: playerState || {
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
      },
    },
  });
};

/**
 * Consensus system adapted for event-sourced engine
 * Runs multiple LLMs, votes on actions, executes winner via engine commands
 */
export async function advanceGameStateWithConsensus(
  engine: DominionEngine,
  playerId: string,
  config: ConsensusConfig = {},
): Promise<void> {
  const {
    humanChoice,
    providers = ALL_FAST_MODELS,
    logger,
    strategySummary,
  } = config;
  const currentState = engine.state;
  const overallStart = performance.now();

  agentLogger.info(`Starting consensus with ${providers.length} models`);

  const legalActions = getLegalActions(currentState);
  logConsensusStart({ currentState, playerId, providers, legalActions, logger });

  const playerState = currentState.players[playerId];
  const hand = playerState?.hand || [];
  const inPlay = playerState?.inPlay || [];
  const handCounts = {
    treasures: hand.filter(isTreasureCard).length,
    actions: hand.filter(isActionCard).length,
    total: hand.length,
  };

  const totalModels = providers.length;
  const aheadByK = Math.max(
    CONSENSUS_AHEAD_BY_K_MIN,
    Math.ceil(totalModels / CONSENSUS_AHEAD_BY_K_DIVISOR),
  );

  const { results, earlyConsensus, voteGroups, completedResults } =
    await runModelsInParallel({
      providers,
      currentState,
      humanChoice,
      strategySummary,
      logger,
      aheadByK,
    });

  const { winner, votesConsidered, validEarlyConsensus, rankedGroups } =
    selectConsensusWinner(voteGroups, results, earlyConsensus, legalActions);

  logVotingResults({
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
  });

  // Execute winner action via engine
  const actionDesc = formatActionDescription(winner.action);
  const success = executeActionWithEngine(engine, winner.action, playerId);

  if (!success) {
    agentLogger.error(`Failed to execute: ${actionDesc}`);
  }

  const overallDuration = performance.now() - overallStart;
  agentLogger.info(
    `${actionDesc} (${winner.count}/${votesConsidered} votes, ${overallDuration.toFixed(0)}ms)`,
  );
}

/**
 * Run full consensus AI turn
 */
export async function runAITurnWithConsensus(
  engine: DominionEngine,
  playerId: string,
  config: AITurnConfig,
): Promise<void> {
  const { providers, logger, onStateChange, strategySummary } = config;
  agentLogger.info(`AI turn start: ${playerId} (${engine.state.phase} phase)`);

  logger?.({
    type: "ai-turn-start",
    message: `AI turn starting`,
    data: { phase: engine.state.phase, providers, turn: engine.state.turn },
  });

  let stepCount = 0;

  while (
    engine.state.activePlayer === playerId &&
    !engine.state.gameOver &&
    !engine.state.pendingDecision &&
    stepCount < MAX_TURN_STEPS
  ) {
    stepCount++;

    try {
      await advanceGameStateWithConsensus(engine, playerId, {
        providers,
        logger,
        strategySummary,
      });

      // Handle AI pending decisions
      const hasAIDecision = (): boolean => {
        const d = engine.state.pendingDecision;
        return d !== null && d.player === playerId;
      };

      while (hasAIDecision()) {
        agentLogger.debug("Resolving pending decision");
        await advanceGameStateWithConsensus(engine, playerId, {
          providers,
          logger,
          strategySummary,
        });
        onStateChange?.(engine.state);

        // Safety check
        if (stepCount++ >= MAX_TURN_STEPS) break;
      }

      onStateChange?.(engine.state);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      agentLogger.error(`Consensus step failed: ${errorMessage}`);
      logger?.({
        type: "consensus-step-error",
        message: `Error: ${errorMessage}`,
        data: { error: errorMessage },
      });
      return;
    }
  }

  agentLogger.info(`AI turn complete (${stepCount} steps)`);
}
