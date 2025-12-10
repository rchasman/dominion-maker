/**
 * LLM Agent - Multi-model consensus system adapted for event-sourced DominionEngine
 */

import type { GameState, CardName } from "../types/game-state";
import type { Action } from "../types/action";
import type { DominionEngine } from "../engine";
import type { ModelProvider } from "../config/models";
import { CARDS, isActionCard, isTreasureCard } from "../data/cards";
import { api } from "../api/client";
import { formatActionDescription } from "../lib/action-utils";
import {
  AVAILABLE_MODELS,
  ALL_FAST_MODELS,
  DEFAULT_MODEL_SETTINGS,
  buildModelsFromSettings,
  type ModelSettings,
} from "./types";
import { agentLogger } from "../lib/logger";
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
let globalAbortController: AbortController | null = null;

// Abort any ongoing consensus operations (e.g., when starting new game)
export function abortOngoingConsensus() {
  if (globalAbortController) {
    agentLogger.info("Aborting consensus");
    globalAbortController.abort();
    globalAbortController = null;
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
};

// Configuration for AI turn operations
type AITurnConfig = {
  providers: ModelProvider[];
  logger?: LLMLogger;
  onStateChange?: (state: GameState) => void;
  strategySummary?: string;
  customStrategy?: string;
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
  customStrategy?: string;
  format?: "json" | "toon";
};

// Call backend API to generate action
async function generateActionViaBackend(
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
  } = params;
  const legalActions = getLegalActions(currentState);

  const { data, error } = await api.api["generate-action"].post(
    {
      provider,
      currentState,
      humanChoice,
      legalActions,
      strategySummary,
      customStrategy,
      format,
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

  return { action: data.action, format: data.format || "toon" };
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

type RunModelsParams = {
  providers: ModelProvider[];
  currentState: GameState;
  humanChoice?: { selectedCards: CardName[] };
  strategySummary?: string;
  customStrategy?: string;
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
    customStrategy,
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
        customStrategy,
        format: index % 2 === 0 ? "json" : "toon",
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
  } = config;
  const currentState = engine.state;
  const overallStart = performance.now();

  agentLogger.info(`Starting consensus with ${providers.length} models`);

  const legalActions = getLegalActions(currentState);

  // Log legal actions for debugging
  const actionSummaries = legalActions.map(a =>
    a.type === "end_phase"
      ? "end_phase"
      : a.type === "choose_from_options"
        ? `choose[${a.optionIndex}]`
        : `${a.type}(${a.card})`,
  );

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
  const { providers, logger, onStateChange, strategySummary, customStrategy } =
    config;
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
        customStrategy,
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
          customStrategy,
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
