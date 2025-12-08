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
import { AVAILABLE_MODELS, ALL_FAST_MODELS, DEFAULT_MODEL_SETTINGS, buildModelsFromSettings, type ModelSettings } from "./types";

// Re-export for convenience
export { AVAILABLE_MODELS, ALL_FAST_MODELS, DEFAULT_MODEL_SETTINGS, buildModelsFromSettings };
export type { ModelSettings, ModelProvider };

// Global abort controller for canceling ongoing consensus operations
let globalAbortController: AbortController | null = null;

// Abort any ongoing consensus operations (e.g., when starting new game)
export function abortOngoingConsensus() {
  if (globalAbortController) {
    console.log("🛑 Aborting ongoing consensus operations");
    globalAbortController.abort();
    globalAbortController = null;
  }
}

// Logger type for capturing LLM activity
export type LLMLogger = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => void;


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
      for (const card of options) {
        actions.push({ type: "trash_card", card });
      }
      // Can't skip trashing by selecting nothing - that would be end_phase or a different action
    } else if (decision.stage === "discard" || decision.stage === "opponent_discard") {
      // Single card at a time (atomic)
      for (const card of options) {
        actions.push({ type: "discard_card", card });
      }
      // Can't skip discarding by selecting nothing - that would be end_phase or a different action
    } else if (decision.stage === "gain" || decision.from === "supply") {
      for (const card of options) {
        actions.push({ type: "gain_card", card });
      }
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
    for (const card of actionCards) {
      if (state.actions > 0) {
        actions.push({ type: "play_action", card });
      }
    }
    actions.push({ type: "end_phase" });
  }

  // Buy phase
  if (state.phase === "buy") {
    const treasures = playerState.hand.filter(isTreasureCard);
    for (const treasure of treasures) {
      actions.push({ type: "play_treasure", card: treasure });
    }

    // Buyable cards
    for (const [card, count] of Object.entries(state.supply)) {
      const cardName = card as CardName;
      if (count > 0 && CARDS[cardName]?.cost <= state.coins && state.buys > 0) {
        actions.push({ type: "buy_card", card: cardName });
      }
    }

    actions.push({ type: "end_phase" });
  }

  return actions;
}

// Call backend API to generate action
async function generateActionViaBackend(
  provider: ModelProvider,
  currentState: GameState,
  humanChoice?: { selectedCards: CardName[] },
  signal?: AbortSignal
): Promise<Action> {
  const legalActions = getLegalActions(currentState);

  const { data, error } = await api.api["generate-action"].post({
    provider,
    currentState,
    humanChoice,
    legalActions,
  }, {
    fetch: { signal },
  });

  if (error) {
    const errorMsg = typeof error === 'object' && error && 'value' in error
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
function executeActionWithEngine(engine: DominionEngine, action: Action, playerId: string): boolean {
  switch (action.type) {
    case "play_action":
      if (!action.card) throw new Error("play_action requires card");
      return engine.dispatch({ type: "PLAY_ACTION", player: playerId, card: action.card }, playerId).ok;
    case "play_treasure":
      if (!action.card) throw new Error("play_treasure requires card");
      return engine.dispatch({ type: "PLAY_TREASURE", player: playerId, card: action.card }, playerId).ok;
    case "buy_card":
      if (!action.card) throw new Error("buy_card requires card");
      return engine.dispatch({ type: "BUY_CARD", player: playerId, card: action.card }, playerId).ok;
    case "end_phase":
      return engine.dispatch({ type: "END_PHASE", player: playerId }, playerId).ok;
    case "discard_card":
    case "trash_card":
    case "gain_card":
      // All decision responses are single cards (atomic)
      if (!action.card) throw new Error(`${action.type} requires card`);
      return engine.dispatch({
        type: "SUBMIT_DECISION",
        player: playerId,
        choice: { selectedCards: [action.card] },
      }, playerId).ok;
    default:
      console.error("Unknown action type:", action);
      return false;
  }
}

/**
 * Consensus system adapted for event-sourced engine
 * Runs multiple LLMs, votes on actions, executes winner via engine commands
 */
export async function advanceGameStateWithConsensus(
  engine: DominionEngine,
  playerId: string,
  humanChoice?: { selectedCards: CardName[] },
  providers: ModelProvider[] = ALL_FAST_MODELS,
  logger?: LLMLogger
): Promise<void> {
  const currentState = engine.state;
  const overallStart = performance.now();

  console.log(`\n🎯 Consensus: Running ${providers.length} models in parallel`, { providers });

  const legalActions = getLegalActions(currentState);

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
        activePlayer: playerState || { hand: [], deck: [], discard: [], inPlay: [], inPlaySourceIndices: [] },
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

  type ModelResult = { provider: ModelProvider; result: Action | null; error: unknown; duration: number };
  type ActionSignature = string;
  type VoteGroup = {
    signature: ActionSignature;
    action: Action;
    voters: ModelProvider[];
    count: number;
  };

  const createActionSignature = (action: Action): ActionSignature => {
    return JSON.stringify(stripReasoning(action));
  };

  const voteGroups = new Map<ActionSignature, VoteGroup>();
  const completedResults: ModelResult[] = [];
  const totalModels = providers.length;
  const aheadByK = Math.max(2, Math.ceil(totalModels / 3));

  const pendingModels = new Set<number>();
  const modelStartTimes = new Map<number, number>();

  globalAbortController = new AbortController();
  const abortController = globalAbortController;

  // Run all models in parallel with early consensus detection
  const { results, earlyConsensus } = await new Promise<{ results: ModelResult[]; earlyConsensus: VoteGroup | null }>((resolveAll) => {
    let resolved = false;
    let completedCount = 0;

    const checkEarlyConsensus = (): VoteGroup | null => {
      const groups = Array.from(voteGroups.values()).sort((a, b) => b.count - a.count);
      if (groups.length === 0) return null;

      const leader = groups[0];
      const runnerUp = groups[1]?.count ?? 0;

      if (leader.count - runnerUp >= aheadByK) {
        return leader;
      }
      return null;
    };

    providers.forEach((provider, index) => {
      const modelStart = performance.now();
      const uiStartTime = Date.now();

      pendingModels.add(index);
      modelStartTimes.set(index, uiStartTime);

      logger?.({
        type: "consensus-model-pending",
        message: `${provider} started`,
        data: { provider, index, startTime: uiStartTime },
      });

      void generateActionViaBackend(provider, currentState, humanChoice, abortController.signal)
        .then((action) => {
          const modelDuration = performance.now() - modelStart;
          logger?.({
            type: "consensus-model-complete",
            message: `${provider} completed in ${modelDuration.toFixed(0)}ms`,
            data: { provider, index, duration: modelDuration, action, success: true },
          });
          return { provider, result: action, error: null, duration: modelDuration };
        })
        .catch((error) => {
          const modelDuration = performance.now() - modelStart;
          const isAborted = error.name === 'AbortError' || error.message?.includes('abort');

          logger?.({
            type: "consensus-model-complete",
            message: isAborted
              ? `${provider} aborted after ${modelDuration.toFixed(0)}ms`
              : `${provider} failed after ${modelDuration.toFixed(0)}ms`,
            data: { provider, index, duration: modelDuration, error: String(error), success: false, aborted: isAborted },
          });
          return { provider, result: null, error, duration: modelDuration };
        })
        .then((modelResult) => {
          pendingModels.delete(index);

          if (resolved) return;

          completedResults.push(modelResult);
          completedCount++;

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

            const winner = checkEarlyConsensus();
            if (winner) {
              resolved = true;
              abortController.abort();

              const nowTime = Date.now();
              for (const pendingIndex of pendingModels) {
                const startTime = modelStartTimes.get(pendingIndex) || nowTime;
                logger?.({
                  type: "consensus-model-aborted",
                  message: `${providers[pendingIndex]} aborted (early consensus)`,
                  data: { provider: providers[pendingIndex], index: pendingIndex, duration: nowTime - startTime },
                });
              }

              resolveAll({ results: completedResults, earlyConsensus: winner });
              return;
            }
          }

          if (completedCount === totalModels) {
            resolveAll({ results: completedResults, earlyConsensus: null });
          }
        });
    });
  });

  if (globalAbortController === abortController) {
    globalAbortController = null;
  }

  const successfulResults = results.filter(r => r.result !== null && !r.error);

  if (!earlyConsensus && successfulResults.length === 0) {
    console.error("✗ All models failed to generate actions");
    // Fall back to simple engine AI
    return runSimpleAITurnWithEngine(engine, playerId);
  }

  const rankedGroups = Array.from(voteGroups.values()).sort((a, b) => b.count - a.count);

  // Validate actions
  const isActionValid = (action: Action): boolean => {
    return legalActions.some(legal => {
      if (legal.type !== action.type) return false;

      // All actions with card field (atomic)
      if (action.type === "play_action" || action.type === "play_treasure" ||
          action.type === "buy_card" || action.type === "gain_card" ||
          action.type === "discard_card" || action.type === "trash_card") {
        return "card" in legal && legal.card === action.card;
      }

      // end_phase has no card
      return action.type === "end_phase";
    });
  };

  const validRankedGroups = rankedGroups.filter(g => isActionValid(g.action));
  const validEarlyConsensus = earlyConsensus && isActionValid(earlyConsensus.action) ? earlyConsensus : null;

  if (!validEarlyConsensus && validRankedGroups.length === 0) {
    console.warn("⚠ All LLM actions were invalid, falling back to simple AI");
    return runSimpleAITurnWithEngine(engine, playerId);
  }

  const winner = validEarlyConsensus || validRankedGroups[0];
  const votesConsidered = earlyConsensus ? completedResults.length : successfulResults.length;
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
        percentage: ((consensusStrength * 100).toFixed(1)) + "%",
        totalVotes: votesConsidered,
        completed: votesConsidered,
        earlyConsensus: !!validEarlyConsensus,
      },
      allResults: rankedGroups.map(g => ({
        action: g.action,
        votes: g.count,
        voters: g.voters,
        valid: isActionValid(g.action),
        reasonings: g.voters.map(voter => {
          const result = completedResults.find(r => {
            if (!r.result) return false;
            return r.provider === voter && JSON.stringify(stripReasoning(r.result)) === JSON.stringify(stripReasoning(g.action));
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
        activePlayer: playerState || { hand: [], deck: [], discard: [], inPlay: [], inPlaySourceIndices: [] },
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

  // Execute winner action via engine
  const success = executeActionWithEngine(engine, winner.action, playerId);

  if (!success) {
    console.error("Failed to execute consensus action:", winner.action);
  }

  const overallDuration = performance.now() - overallStart;
  console.log(`✓ Consensus complete in ${overallDuration.toFixed(0)}ms`, {
    action: actionDesc,
    votes: `${winner.count}/${votesConsidered}`,
    earlyConsensus: !!earlyConsensus,
  });
}

/**
 * Simple AI fallback using engine commands
 */
function runSimpleAITurnWithEngine(engine: DominionEngine, playerId: string): void {
  const state = engine.state;

  // If there's a pending decision for this player, resolve it first
  if (state.pendingDecision && state.pendingDecision.player === playerId) {
    const decision = state.pendingDecision;
    const options = decision.cardOptions || [];

    // Pick first min cards or skip if allowed
    const numToSelect = decision.min === 0 ? 0 : Math.min(decision.min, options.length);
    const selected: CardName[] = options.slice(0, numToSelect);

    console.log("[SimpleAI] Resolving decision:", decision.stage, "selecting:", selected);
    engine.dispatch({
      type: "SUBMIT_DECISION",
      player: playerId,
      choice: { selectedCards: selected },
    }, playerId);
    return;
  }

  const playerState = state.players[playerId];
  if (!playerState) return;

  // Action phase: play all actions
  if (state.phase === "action") {
    const actions = playerState.hand.filter(isActionCard);
    for (const action of actions) {
      if (state.actions > 0) {
        engine.dispatch({ type: "PLAY_ACTION", player: playerId, card: action }, playerId);
      }
    }
    engine.dispatch({ type: "END_PHASE", player: playerId }, playerId);
  }

  // Buy phase: play all treasures, buy best affordable
  if (state.phase === "buy") {
    const treasures = playerState.hand.filter(isTreasureCard);
    for (const treasure of treasures) {
      engine.dispatch({ type: "PLAY_TREASURE", player: playerId, card: treasure }, playerId);
    }

    const buyPriority: CardName[] = ["Province", "Gold", "Duchy", "Silver", "Estate"];
    for (const card of buyPriority) {
      if (state.supply[card] > 0 && CARDS[card].cost <= state.coins && state.buys > 0) {
        engine.dispatch({ type: "BUY_CARD", player: playerId, card }, playerId);
        break;
      }
    }

    engine.dispatch({ type: "END_PHASE", player: playerId }, playerId);
  }
}

/**
 * Run full consensus AI turn
 */
export async function runAITurnWithConsensus(
  engine: DominionEngine,
  playerId: string,
  providers: ModelProvider[],
  logger?: LLMLogger,
  onStateChange?: (state: GameState) => void
): Promise<void> {
  console.log(`\n🤖 Consensus AI turn starting`, { phase: engine.state.phase });

  logger?.({
    type: "ai-turn-start",
    message: `AI turn starting`,
    data: { phase: engine.state.phase, providers, turn: engine.state.turn },
  });

  let stepCount = 0;
  const MAX_STEPS = 20;

  while (
    engine.state.activePlayer === playerId &&
    !engine.state.gameOver &&
    !engine.state.pendingDecision &&
    stepCount < MAX_STEPS
  ) {
    stepCount++;

    try {
      await advanceGameStateWithConsensus(engine, playerId, undefined, providers, logger);

      // Handle AI pending decisions
      const hasAIDecision = (): boolean => {
        const d = engine.state.pendingDecision;
        return d !== null && d.player === playerId;
      };

      while (hasAIDecision()) {
        console.log("⚙ AI has pendingDecision, resolving via consensus");
        await advanceGameStateWithConsensus(engine, playerId, undefined, providers, logger);
        onStateChange?.(engine.state);

        // Safety check
        if (stepCount++ >= MAX_STEPS) break;
      }

      onStateChange?.(engine.state);
    } catch (error) {
      console.error("Error during consensus step:", error);
      logger?.({
        type: "consensus-step-error",
        message: `Error: ${String(error)}`,
        data: { error: String(error) },
      });
      return;
    }
  }

  console.log(`✓ Consensus AI turn complete after ${stepCount} steps`);
}
