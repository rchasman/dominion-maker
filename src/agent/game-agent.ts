/**
 * LLM Agent - Multi-model consensus system adapted for event-sourced DominionEngine
 */

import type { GameState, CardName, PlayerId } from "../types/game-state";
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
import { isDecisionChoice } from "../types/pending-choice";
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
import {
  isMultiActionDecision,
  isBatchDecision,
  simulateCardSelection,
} from "./decision-reconstructor";

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
    ...(logger !== undefined && { logger }),
  };

  void generateActionViaBackend({
    provider,
    currentState,
    ...(humanChoice !== undefined && { humanChoice }),
    signal: modelAbortController.signal,
    ...(strategySummary !== undefined && { strategySummary }),
    ...(customStrategy !== undefined && { customStrategy }),
    format: context.format,
    ...(actionId !== undefined && { actionId }),
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
        ...(humanChoice !== undefined && { humanChoice }),
        ...(strategySummary !== undefined && { strategySummary }),
        ...(customStrategy !== undefined && { customStrategy }),
        format: modelFormat,
        actionId,
        abortController,
        voteGroups,
        completedResultsMap,
        aheadByK,
        ...(logger !== undefined && { logger }),
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
 * Handle batch consensus (Chapel, Cellar) - vote on cards one at a time
 */
async function handleBatchConsensus(
  engine: DominionEngine,
  playerId: PlayerId,
  decision: Extract<
    NonNullable<GameState["pendingChoice"]>,
    { choiceType: "decision" }
  >,
  config: {
    providers: ModelProvider[];
    humanChoice?: { selectedCards: CardName[] };
    logger?: LLMLogger;
    strategySummary?: string;
    customStrategy?: string;
    dataFormat: "toon" | "json" | "mixed";
    actionId: string;
    overallStart: number;
  },
): Promise<void> {
  const { max } = decision;
  const aheadByK = Math.max(
    CONSENSUS_AHEAD_BY_K_MIN,
    Math.ceil(config.providers.length / CONSENSUS_AHEAD_BY_K_DIVISOR),
  );

  agentLogger.info(
    `Batch decision detected: max=${max}, running multi-round consensus`,
  );

  const runBatchRound = async (
    round: number,
    acc: { cards: CardName[]; engine: DominionEngine },
  ): Promise<{ cards: CardName[]; engine: DominionEngine }> => {
    if (round >= (max ?? 1)) return acc;

    const legalActions = getLegalActions(acc.engine.state);
    agentLogger.info(
      `Batch round ${round + 1}/${max}: ${legalActions.length} legal actions`,
    );

    const { results, earlyConsensus, voteGroups, completedResults } =
      await runModelsInParallel({
        providers: config.providers,
        dataFormat: config.dataFormat,
        ...(config.humanChoice !== undefined && {
          humanChoice: config.humanChoice,
        }),
        ...(config.logger !== undefined && { logger: config.logger }),
        ...(config.strategySummary !== undefined && {
          strategySummary: config.strategySummary,
        }),
        ...(config.customStrategy !== undefined && {
          customStrategy: config.customStrategy,
        }),
        currentState: acc.engine.state,
        aheadByK,
        actionId: `${config.actionId}-r${round}`,
      });

    const { winner, votesConsidered, validEarlyConsensus, rankedGroups } =
      selectConsensusWinner(voteGroups, results, earlyConsensus, legalActions);

    const playerState = acc.engine.state.players[playerId];
    const hand = playerState?.hand || [];
    const inPlay = playerState?.inPlay || [];
    const handCounts = {
      treasures: hand.filter(isTreasureCard).length,
      actions: hand.filter(isActionCard).length,
      total: hand.length,
    };

    logVotingResults({
      winner,
      votesConsidered,
      validEarlyConsensus,
      rankedGroups,
      aheadByK,
      completedResults,
      legalActions,
      overallStart: config.overallStart,
      currentState: acc.engine.state,
      playerState,
      hand,
      inPlay,
      handCounts,
      ...(config.logger !== undefined && { logger: config.logger }),
    });

    if (winner.action.type === "skip_decision") {
      agentLogger.info(`AI voted to skip after ${acc.cards.length} selections`);
      return acc;
    }

    if (winner.action.type === "choose_from_options") {
      agentLogger.warn("Cannot reconstruct batch from option choice");
      return acc;
    }
    const card = winner.action.card;
    if (!card) {
      agentLogger.warn("Action missing card, stopping batch reconstruction");
      return acc;
    }

    agentLogger.info(
      `Batch round ${round + 1} winner: ${winner.action.type}(${card}) - ${
        winner.count
      } votes`,
    );

    return runBatchRound(round + 1, {
      cards: [...acc.cards, card],
      engine: simulateCardSelection(acc.engine, card),
    });
  };

  const { cards: selectedCards } = await runBatchRound(0, {
    cards: [],
    engine,
  });

  const success = engine.dispatch(
    {
      type: "SUBMIT_DECISION",
      playerId,
      choice: { selectedCards },
    },
    playerId,
  ).ok;

  if (!success) {
    agentLogger.error("Failed to submit batch decision");
  }

  const overallDuration = performance.now() - config.overallStart;
  agentLogger.info(
    `Batch decision complete: ${
      selectedCards.length
    } cards (${overallDuration.toFixed(0)}ms)`,
  );
}

/**
 * Handle multi-action consensus (Sentry, Library) - vote on action per card
 */
async function handleMultiActionConsensus(
  engine: DominionEngine,
  playerId: PlayerId,
  decision: Extract<
    NonNullable<GameState["pendingChoice"]>,
    { choiceType: "decision" }
  >,
  config: {
    providers: ModelProvider[];
    humanChoice?: { selectedCards: CardName[] };
    logger?: LLMLogger;
    strategySummary?: string;
    customStrategy?: string;
    dataFormat: "toon" | "json" | "mixed";
    actionId: string;
    overallStart: number;
  },
): Promise<void> {
  const numCards = decision.cardOptions.length;
  const aheadByK = Math.max(
    CONSENSUS_AHEAD_BY_K_MIN,
    Math.ceil(config.providers.length / CONSENSUS_AHEAD_BY_K_DIVISOR),
  );

  agentLogger.info(
    `Multi-action decision detected: ${numCards} cards, running multi-round consensus`,
  );

  const defaultAction = decision.actions?.find(a => a.isDefault);
  if (!defaultAction) {
    throw new Error("Multi-action decision requires default action");
  }

  const cardActions = await Array.from({ length: numCards })
    .map((_, i) => i)
    .reduce<Promise<Record<number, string>>>(async (accPromise, roundIndex) => {
      const acc = await accPromise;

      const currentCard = decision.cardOptions[roundIndex];
      if (!currentCard) {
        agentLogger.warn(`No card at index ${roundIndex}, skipping round`);
        return acc;
      }

      const roundState: GameState = {
        ...engine.state,
        pendingChoice: isDecisionChoice(engine.state.pendingChoice)
          ? {
              ...engine.state.pendingChoice,
              prompt: `${engine.state.pendingChoice.prompt} (Card ${
                roundIndex + 1
              }/${numCards}: ${currentCard})`,
              metadata: {
                ...engine.state.pendingChoice.metadata,
                currentRoundIndex: roundIndex,
              },
            }
          : engine.state.pendingChoice,
      };

      const legalActions = getLegalActions(roundState);

      agentLogger.info(
        `Round ${roundIndex + 1}/${numCards}: Voting on ${currentCard}`,
      );

      const { results, earlyConsensus, voteGroups } = await runModelsInParallel(
        {
          providers: config.providers,
          dataFormat: config.dataFormat,
          ...(config.humanChoice !== undefined && {
            humanChoice: config.humanChoice,
          }),
          ...(config.logger !== undefined && { logger: config.logger }),
          ...(config.strategySummary !== undefined && {
            strategySummary: config.strategySummary,
          }),
          ...(config.customStrategy !== undefined && {
            customStrategy: config.customStrategy,
          }),
          currentState: roundState,
          aheadByK,
          actionId: `${config.actionId}-r${roundIndex}`,
        },
      );

      const { winner } = selectConsensusWinner(
        voteGroups,
        results,
        earlyConsensus,
        legalActions,
      );

      if (winner.action.type === "skip_decision") {
        agentLogger.info(
          `AI skipped at round ${roundIndex + 1}, using defaults for remaining`,
        );
        return acc;
      }

      agentLogger.debug(
        `Card ${roundIndex} (${currentCard}): ${winner.action.type}`,
      );

      return { ...acc, [roundIndex]: winner.action.type };
    }, Promise.resolve({}));

  const cardActionsWithDefaults = Object.fromEntries(
    Array.from({ length: numCards }).map((_, i) => {
      const action = i in cardActions ? cardActions[i] : undefined;
      return [i, action ?? defaultAction.id];
    }),
  ) as Record<number, string>;

  const cardOrder = Object.entries(cardActionsWithDefaults)
    .filter(([, actionId]) => actionId === "topdeck_card")
    .map(([index]) => parseInt(index));

  const finalChoice = {
    selectedCards: [],
    cardActions: cardActionsWithDefaults,
    cardOrder,
  };

  const success = engine.dispatch(
    {
      type: "SUBMIT_DECISION",
      playerId,
      choice: finalChoice,
    },
    playerId,
  ).ok;

  if (!success) {
    agentLogger.error("Failed to submit multi-action decision");
  }

  const overallDuration = performance.now() - config.overallStart;
  const actionCount = Object.keys(cardActions).length;
  agentLogger.info(
    `Multi-action decision complete: ${actionCount} actions (${overallDuration.toFixed(
      0,
    )}ms)`,
  );
}

/**
 * Consensus system adapted for event-sourced engine
 * Runs multiple LLMs, votes on actions, executes winner via engine commands
 */
export async function advanceGameStateWithConsensus(
  engine: DominionEngine,
  playerId: PlayerId,
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

  const actionId = `t${currentState.turn}-${currentState.phase}-${Date.now()}`;

  agentLogger.info(`Starting consensus with ${providers.length} models`);

  const decision = currentState.pendingChoice;

  const helperConfig = {
    providers,
    ...(humanChoice !== undefined ? { humanChoice } : {}),
    ...(logger !== undefined ? { logger } : {}),
    ...(strategySummary !== undefined ? { strategySummary } : {}),
    ...(customStrategy !== undefined ? { customStrategy } : {}),
    dataFormat,
    actionId,
    overallStart,
  };

  if (isBatchDecision(decision) && !isMultiActionDecision(decision)) {
    return handleBatchConsensus(engine, playerId, decision, helperConfig);
  }

  if (isMultiActionDecision(decision)) {
    return handleMultiActionConsensus(engine, playerId, decision, helperConfig);
  }

  const legalActions = getLegalActions(currentState);

  // Shortcut: if only one legal action, execute it directly without consensus
  if (legalActions.length === 1) {
    const action = legalActions[0];
    if (!action) {
      agentLogger.error("Expected action but got undefined");
      return;
    }
    const actionDesc = formatActionDescription(action);
    agentLogger.info(
      `Only one legal action: ${actionDesc} (skipping consensus)`,
    );

    logger?.({
      type: "consensus-skipped",
      message: `Only one legal action available`,
      data: { action: actionDesc, turn: currentState.turn },
    });

    const success = executeActionWithEngine(engine, action, playerId);
    if (!success) {
      agentLogger.error(`Failed to execute: ${actionDesc}`);
    }
    return;
  }

  // Log legal actions for debugging
  const actionSummaries = legalActions.map(a => {
    if (a.type === "end_phase") return "end_phase";
    if (a.type === "choose_from_options") return `choose[${a.optionIndex}]`;
    return `${a.type}(${a.card})`;
  });

  // If in buy phase, show detailed supply info
  if (currentState.phase === "buy" && currentState.buys > 0) {
    const buyableCards = legalActions
      .filter(a => a.type === "buy_card" && "card" in a && a.card != null)
      .map(a => {
        if (a.type !== "buy_card" || !("card" in a) || a.card == null)
          return "";
        const cost = CARDS[a.card]?.cost || 0;
        return `${a.card}($${cost})`;
      })
      .filter(Boolean)
      .join(", ");
    agentLogger.info(
      `Buy phase: $${currentState.coins} available | Buyable: ${buyableCards}`,
    );
  }

  agentLogger.debug(
    `Legal actions (${legalActions.length}): ${actionSummaries.join(
      ", ",
    )} | Coins: ${currentState.coins}, Buys: ${currentState.buys}`,
  );

  logConsensusStart({
    currentState,
    playerId,
    providers,
    legalActions,
    ...(logger !== undefined && { logger }),
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
      ...(humanChoice !== undefined && { humanChoice }),
      ...(strategySummary !== undefined && { strategySummary }),
      ...(customStrategy !== undefined && { customStrategy }),
      ...(logger !== undefined && { logger }),
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
    ...(logger !== undefined && { logger }),
  });

  // Execute winner action via engine
  const actionDesc = formatActionDescription(winner.action);
  const success = executeActionWithEngine(engine, winner.action, playerId);

  if (!success) {
    agentLogger.error(`Failed to execute: ${actionDesc}`);
  }

  const overallDuration = performance.now() - overallStart;
  agentLogger.info(
    `${actionDesc} (${
      winner.count
    }/${votesConsidered} votes, ${overallDuration.toFixed(0)}ms)`,
  );
}

/**
 * Run full consensus AI turn
 */
export async function runAITurnWithConsensus(
  engine: DominionEngine,
  playerId: PlayerId,
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
      engine.state.pendingChoice &&
      engine.state.pendingChoice.playerId !== playerId;

    if (
      engine.state.activePlayerId !== playerId ||
      engine.state.gameOver ||
      hasOpponentDecision ||
      stepCount >= MAX_TURN_STEPS
    ) {
      return stepCount;
    }

    try {
      await advanceGameStateWithConsensus(engine, playerId, {
        providers,
        ...(logger !== undefined && { logger }),
        ...(strategySummary !== undefined && { strategySummary }),
        ...(customStrategy !== undefined && { customStrategy }),
        dataFormat,
      });

      // Handle AI pending decisions
      const hasAIDecision = (): boolean => {
        const d = engine.state.pendingChoice;
        return d !== null && d.playerId === playerId;
      };

      const resolveDecisions = async (count: number): Promise<number> => {
        if (!hasAIDecision() || count >= MAX_TURN_STEPS) {
          return count;
        }

        agentLogger.debug("Resolving pending decision");
        await advanceGameStateWithConsensus(engine, playerId, {
          providers,
          ...(logger !== undefined && { logger }),
          ...(strategySummary !== undefined && { strategySummary }),
          ...(customStrategy !== undefined && { customStrategy }),
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
