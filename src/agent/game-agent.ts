/**
 * LLM Agent - Multi-model consensus system adapted for event-sourced DominionEngine
 */

import type { GameState, CardName } from "../types/game-state";
import type { DominionEngine } from "../engine";
import type { ModelProvider } from "../config/models";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
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
import {
  getLegalActions,
  generateActionViaBackend,
  executeActionWithEngine,
} from "./game-agent-helpers";
import {
  type LLMLogger,
  type ModelResult,
  type ActionSignature,
  type VoteGroup,
  type ModelHandlerParams,
  type ModelExecutionContext,
  MODEL_TIMEOUT_MS,
  handleModelSuccess,
  handleModelError,
  handleModelResult,
  selectConsensusWinner,
  logVotingResults,
  logConsensusStart,
} from "./consensus-helpers";

// Constants
const CONSENSUS_AHEAD_BY_K_MIN = 2;
const CONSENSUS_AHEAD_BY_K_DIVISOR = 3;
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
const globalAbortState = { current: null as AbortController | null };

// Abort any ongoing consensus operations (e.g., when starting new game)
export function abortOngoingConsensus() {
  if (globalAbortState.current) {
    agentLogger.info("Aborting consensus");
    globalAbortState.current.abort();
    globalAbortState.current = null;
  }
}

// Re-export LLMLogger for external use
export type { LLMLogger };

// Configuration for consensus operations
type ConsensusConfig = {
  humanChoice?: { selectedCards: CardName[] };
  providers?: ModelProvider[];
  logger?: LLMLogger;
  strategySummary?: string;
  customStrategy?: string;
  dataFormat?: "toon" | "json" | "mixed";
};

// Configuration for AI turn operations
type AITurnConfig = {
  providers: ModelProvider[];
  logger?: LLMLogger;
  onStateChange?: (state: GameState) => void;
  strategySummary?: string;
  customStrategy?: string;
  dataFormat?: "toon" | "json" | "mixed";
};

// Execute a single model and handle its result
const executeModel = (context: ModelExecutionContext): void => {
  const {
    provider,
    index,
    currentState,
    humanChoice,
    strategySummary,
    customStrategy,
    actionId,
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
    data: { provider, index, startTime: uiStartTime, format: context.format },
  });

  const modelAbortController = new AbortController();
  const timeoutId = setTimeout(() => {
    modelAbortController.abort();
  }, MODEL_TIMEOUT_MS);

  const abortHandler = () => modelAbortController.abort();
  abortController.signal.addEventListener("abort", abortHandler);

  const handlerParams: ModelHandlerParams = {
    provider,
    index,
    modelStart,
    logger,
  };

  void generateActionViaBackend({
    provider,
    currentState,
    humanChoice,
    signal: modelAbortController.signal,
    strategySummary,
    customStrategy,
    format: context.format,
    actionId,
  })
    .then(({ action, format }) => {
      clearTimeout(timeoutId);
      return handleModelSuccess(action, format, handlerParams);
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
      context.completedResultsMap.set(index, modelResult);
      handleModelResult(modelResult, context);
    });
};

type RunModelsParams = {
  providers: ModelProvider[];
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  strategySummary?: string;
  customStrategy?: string;
  logger?: LLMLogger;
  aheadByK: number;
  dataFormat: "toon" | "json" | "mixed";
  actionId: string;
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
    customStrategy,
    logger,
    aheadByK,
    dataFormat,
    actionId,
  } = params;

  const voteGroups = new Map<ActionSignature, VoteGroup>();
  const completedResultsMap = new Map<number, ModelResult>();
  const totalModels = providers.length;
  const pendingModels = new Set<number>();
  const modelStartTimes = new Map<number, number>();

  globalAbortState.current = new AbortController();
  const abortController = globalAbortState.current;

  const { results, earlyConsensus } = await new Promise<{
    results: ModelResult[];
    earlyConsensus: VoteGroup | null;
  }>(resolveAll => {
    const state = { resolved: false, completedCount: 0 };

    providers.map((provider, index) => {
      const modelFormat = run(() => {
        if (dataFormat === "mixed") {
          const TWO = 2;
          return index % TWO === 0 ? "json" : "toon";
        }
        return dataFormat;
      });

      return executeModel({
        provider,
        index,
        currentState,
        humanChoice,
        strategySummary,
        customStrategy,
        format: modelFormat,
        actionId,
        abortController,
        voteGroups,
        completedResultsMap,
        aheadByK,
        logger,
        pendingModels,
        modelStartTimes,
        providers,
        onEarlyConsensus: (winner: VoteGroup) => {
          if (state.resolved) return;
          state.resolved = true;
          const results = Array.from(completedResultsMap.values());
          resolveAll({ results, earlyConsensus: winner });
        },
        onComplete: () => {
          if (state.resolved) return;
          state.completedCount++;
          if (state.completedCount === totalModels) {
            const results = Array.from(completedResultsMap.values());
            resolveAll({ results, earlyConsensus: null });
          }
        },
      });
    });
  });

  if (globalAbortState.current === abortController) {
    globalAbortState.current = null;
  }

  const completedResults = Array.from(completedResultsMap.values());
  return { results, earlyConsensus, voteGroups, completedResults };
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
    customStrategy,
    dataFormat = "toon",
  } = config;
  const currentState = engine.state;
  const overallStart = performance.now();

  // Generate actionId to group all consensus votes in devtools
  // Cache cleared on new game, so just use turn+phase+timestamp
  const actionId = `t${currentState.turn}-${currentState.phase}-${Date.now()}`;

  agentLogger.info(`Starting consensus with ${providers.length} models`);

  const legalActions = getLegalActions(currentState);

  // Log legal actions for debugging
  const actionSummaries = legalActions.map(a => {
    if (a.type === "end_phase") return "end_phase";
    if (a.type === "choose_from_options") return `choose[${a.optionIndex}]`;
    return `${a.type}(${a.card})`;
  });

  // If in buy phase, show detailed supply info
  if (currentState.phase === "buy" && currentState.buys > 0) {
    const buyableCards = legalActions
      .filter(a => a.type === "buy_card")
      .map(a => {
        const card = a.card as CardName;
        const cost = CARDS[card]?.cost || 0;
        return `${card}($${cost})`;
      })
      .join(", ");
    agentLogger.info(
      `Buy phase: $${currentState.coins} available | Buyable: ${buyableCards}`,
    );
  }

  agentLogger.debug(
    `Legal actions (${legalActions.length}): ${actionSummaries.join(", ")} | Coins: ${currentState.coins}, Buys: ${currentState.buys}`,
  );

  logConsensusStart({
    currentState,
    playerId,
    providers,
    legalActions,
    logger,
  });

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
      customStrategy,
      logger,
      aheadByK,
      dataFormat,
      actionId,
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
  const {
    providers,
    logger,
    onStateChange,
    strategySummary,
    customStrategy,
    dataFormat = "mixed",
  } = config;
  agentLogger.info(`AI turn start: ${playerId} (${engine.state.phase} phase)`);

  logger?.({
    type: "ai-turn-start",
    message: `AI turn starting`,
    data: { phase: engine.state.phase, providers, turn: engine.state.turn },
  });

  const runTurnSteps = async (stepCount: number): Promise<number> => {
    const hasOpponentDecision =
      engine.state.pendingDecision &&
      engine.state.pendingDecision.player !== playerId;

    if (
      engine.state.activePlayer !== playerId ||
      engine.state.gameOver ||
      hasOpponentDecision ||
      stepCount >= MAX_TURN_STEPS
    ) {
      return stepCount;
    }

    try {
      await advanceGameStateWithConsensus(engine, playerId, {
        providers,
        logger,
        strategySummary,
        customStrategy,
        dataFormat,
      });

      // Handle AI pending decisions
      const hasAIDecision = (): boolean => {
        const d = engine.state.pendingDecision;
        return d !== null && d.player === playerId;
      };

      const resolveDecisions = async (count: number): Promise<number> => {
        if (!hasAIDecision() || count >= MAX_TURN_STEPS) {
          return count;
        }

        agentLogger.debug("Resolving pending decision");
        await advanceGameStateWithConsensus(engine, playerId, {
          providers,
          logger,
          strategySummary,
          customStrategy,
          dataFormat,
        });
        onStateChange?.(engine.state);

        return resolveDecisions(count + 1);
      };

      const newStepCount = await resolveDecisions(stepCount + 1);

      onStateChange?.(engine.state);

      return runTurnSteps(newStepCount);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      agentLogger.error(`Consensus step failed: ${errorMessage}`);
      logger?.({
        type: "consensus-step-error",
        message: `Error: ${errorMessage}`,
        data: { error: errorMessage },
      });
      return stepCount;
    }
  };

  const finalStepCount = await runTurnSteps(0);

  agentLogger.info(`AI turn complete (${finalStepCount} steps)`);
}
