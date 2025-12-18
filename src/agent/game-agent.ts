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
        onEarlyConsensus: (winnerId: VoteGroup) => {
          if (state.resolved) return;
          state.resolved = true;
          const results = Array.from(completedResultsMap.values());
          resolveAll({ results, earlyConsensus: winnerId });
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

  // Generate actionId to group all consensus votes in devtools
  // Cache cleared on new game, so just use turn+phase+timestamp
  const actionId = `t${currentState.turn}-${currentState.phase}-${Date.now()}`;

  agentLogger.info(`Starting consensus with ${providers.length} models`);

  // Check for special decision types requiring multi-round consensus
  const decision = currentState.pendingChoice;

  // Check for batch decision (like Chapel: max > 1) - requires multi-round consensus
  if (isBatchDecision(decision) && !isMultiActionDecision(decision)) {
    agentLogger.info(
      `Batch decision detected: max=${decision.max}, running multi-round consensus`,
    );

    const { max } = decision;
    const aheadByK = Math.max(
      CONSENSUS_AHEAD_BY_K_MIN,
      Math.ceil(providers.length / CONSENSUS_AHEAD_BY_K_DIVISOR),
    );

    const runBatchRound = async (
      round: number,
      acc: { cards: CardName[]; engine: DominionEngine },
    ): Promise<{ cards: CardName[]; engine: DominionEngine }> => {
      if (round >= max) return acc;

      const legalActions = getLegalActions(acc.engine.state);

      agentLogger.info(
        `Batch round ${round + 1}/${max}: ${legalActions.length} legal actions`,
      );

      const { results, earlyConsensus, voteGroups, completedResults } =
        await runModelsInParallel({
          providers,
          currentState: acc.engine.state,
          humanChoice,
          strategySummary,
          customStrategy,
          logger,
          aheadByK,
          dataFormat,
          actionId: `${actionId}-r${round}`,
        });

      const { winnerId, votesConsidered, validEarlyConsensus, rankedGroups } =
        selectConsensusWinner(
          voteGroups,
          results,
          earlyConsensus,
          legalActions,
        );

      // Compute player context for logging
      const playerState = acc.engine.state.players[playerId];
      const hand = playerState?.hand || [];
      const inPlay = playerState?.inPlay || [];
      const handCounts = {
        treasures: hand.filter(isTreasureCard).length,
        actions: hand.filter(isActionCard).length,
        total: hand.length,
      };

      // Log voting results for this batch round
      logVotingResults({
        winnerId,
        votesConsidered,
        validEarlyConsensus,
        rankedGroups,
        aheadByK,
        completedResults,
        legalActions,
        overallStart,
        currentState: acc.engine.state,
        playerState,
        hand,
        inPlay,
        handCounts,
        logger,
      });

      if (winnerId.action.type === "skip_decision") {
        agentLogger.info(
          `AI voted to skip after ${acc.cards.length} selections`,
        );
        return acc;
      }

      const card = winnerId.action.card;
      if (!card) {
        agentLogger.warn("Action missing card, stopping batch reconstruction");
        return acc;
      }

      agentLogger.info(
        `Batch round ${round + 1} winnerId: ${winnerId.action.type}(${card}) - ${
          winnerId.count
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

    // Submit accumulated batch
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

    const overallDuration = performance.now() - overallStart;
    agentLogger.info(
      `Batch decision complete: ${
        selectedCards.length
      } cards (${overallDuration.toFixed(0)}ms)`,
    );
    return;
  }

  if (isMultiActionDecision(decision)) {
    agentLogger.info(
      `Multi-action decision detected: ${decision.cardOptions.length} cards, running multi-round consensus`,
    );

    const numCards = decision.cardOptions.length;
    const aheadByK = Math.max(
      CONSENSUS_AHEAD_BY_K_MIN,
      Math.ceil(providers.length / CONSENSUS_AHEAD_BY_K_DIVISOR),
    );

    const defaultAction = decision.actions?.find(a => a.isDefault);
    if (!defaultAction) {
      throw new Error("Multi-action decision requires default action");
    }

    const cardActions = await Array.from({ length: numCards })
      .map((_, i) => i)
      .reduce<Promise<Record<number, string>>>(
        async (accPromise, roundIndex) => {
          const acc = await accPromise;

          const roundState: GameState = {
            ...engine.state,
            pendingChoice: engine.state.pendingChoice
              ? {
                  ...engine.state.pendingChoice,
                  prompt: `${engine.state.pendingChoice.prompt} (Card ${
                    roundIndex + 1
                  }/${numCards}: ${
                    engine.state.pendingChoice.cardOptions[roundIndex]
                  })`,
                  metadata: {
                    ...engine.state.pendingChoice.metadata,
                    currentRoundIndex: roundIndex,
                  },
                }
              : null,
          };

          const legalActions = getLegalActions(roundState);

          agentLogger.info(
            `Round ${roundIndex + 1}/${numCards}: Voting on ${
              decision.cardOptions[roundIndex]
            }`,
          );

          const { results, earlyConsensus, voteGroups } =
            await runModelsInParallel({
              providers,
              currentState: roundState,
              humanChoice,
              strategySummary,
              customStrategy,
              logger,
              aheadByK,
              dataFormat,
              actionId: `${actionId}-r${roundIndex}`,
            });

          const { winner } = selectConsensusWinner(
            voteGroups,
            results,
            earlyConsensus,
            legalActions,
          );

          if (winnerId.action.type === "skip_decision") {
            agentLogger.info(
              `AI skipped at round ${
                roundIndex + 1
              }, using defaults for remaining`,
            );
            return acc;
          }

          agentLogger.debug(
            `Card ${roundIndex} (${decision.cardOptions[roundIndex]}): ${winnerId.action.type}`,
          );

          return { ...acc, [roundIndex]: winnerId.action.type };
        },
        Promise.resolve({}),
      );

    const cardActionsWithDefaults = Object.fromEntries(
      Array.from({ length: numCards }).map((_, i) => [
        i,
        i in cardActions ? cardActions[i] : defaultAction.id,
      ]),
    );

    const cardOrder = Object.entries(cardActionsWithDefaults)
      .filter(([, actionId]) => actionId === "topdeck_card")
      .map(([index]) => parseInt(index));

    const finalChoice = {
      selectedCards: [],
      cardActions: cardActionsWithDefaults,
      cardOrder,
    };

    // Execute the full decision
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

    const overallDuration = performance.now() - overallStart;
    const actionCount = Object.keys(cardActions).length;
    agentLogger.info(
      `Multi-action decision complete: ${actionCount} actions (${overallDuration.toFixed(
        0,
      )}ms)`,
    );
    return;
  }

  const legalActions = getLegalActions(currentState);

  // Shortcut: if only one legal action, execute it directly without consensus
  if (legalActions.length === 1) {
    const action = legalActions[0];
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
    `Legal actions (${legalActions.length}): ${actionSummaries.join(
      ", ",
    )} | Coins: ${currentState.coins}, Buys: ${currentState.buys}`,
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

  const { winnerId, votesConsidered, validEarlyConsensus, rankedGroups } =
    selectConsensusWinner(voteGroups, results, earlyConsensus, legalActions);

  logVotingResults({
    winnerId,
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
  const actionDesc = formatActionDescription(winnerId.action);
  const success = executeActionWithEngine(engine, winnerId.action, playerId);

  if (!success) {
    agentLogger.error(`Failed to execute: ${actionDesc}`);
  }

  const overallDuration = performance.now() - overallStart;
  agentLogger.info(
    `${actionDesc} (${
      winnerId.count
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
        logger,
        strategySummary,
        customStrategy,
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
