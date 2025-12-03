import { GameState } from "../types/game-state";
import { Action } from "../types/action";
import type { LLMLogEntry } from "../components/LLMLog";
import {
  playAction,
  playTreasure,
  buyCard,
  endActionPhase,
  endBuyPhase,
  runSimpleAITurn,
  getLegalActions,
  resolveDecision,
} from "../lib/game-engine";
import { MODEL_IDS, getModelFullName, type ModelProvider } from "../config/models";

// Re-export for convenience
export type { ModelProvider } from "../config/models";

// Backend API endpoint
const API_URL = "http://localhost:5174/api/generate-action";

// Default: 8 fast model instances for maximum consensus (duplicates allowed)
export const ALL_FAST_MODELS: ModelProvider[] = [
  "claude-haiku",
  "gpt-4o-mini",
  "gemini-2.5-flash-lite",
  "ministral-3b",
  "claude-haiku",
  "gpt-4o-mini",
  "gemini-2.5-flash-lite",
  "ministral-3b",
];

// Available unique models
export const AVAILABLE_MODELS: ModelProvider[] = MODEL_IDS as ModelProvider[];

// Model settings for consensus
export interface ModelSettings {
  enabledModels: Set<ModelProvider>;
  consensusCount: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  enabledModels: new Set(["claude-haiku", "gpt-4o-mini", "gemini-2.5-flash-lite", "ministral-3b"]),
  consensusCount: 8,
};

// Logger type for capturing LLM activity
export type LLMLogger = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => void;

// Build models array from settings by shuffling and duplicating enabled models
export function buildModelsFromSettings(settings: ModelSettings): ModelProvider[] {
  const enabled = Array.from(settings.enabledModels);

  if (enabled.length === 0) {
    console.warn("No models enabled, using defaults");
    return ALL_FAST_MODELS;
  }

  // Create array by cycling through enabled models
  const models: ModelProvider[] = [];
  for (let i = 0; i < settings.consensusCount; i++) {
    models.push(enabled[i % enabled.length]);
  }

  // Shuffle the array for randomness
  for (let i = models.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [models[i], models[j]] = [models[j], models[i]];
  }

  return models;
}

// Call backend API to generate action
async function generateActionViaBackend(
  provider: ModelProvider,
  currentState: GameState,
  humanChoice?: { selectedCards: string[] }
): Promise<Action> {
  const legalActions = getLegalActions(currentState);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, currentState, humanChoice, legalActions }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Backend request failed");
  }

  const data = await response.json();
  return data.action;
}

// Execute an atomic action and return new state
function executeAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "play_action":
      if (!action.card) throw new Error("play_action requires card");
      return playAction(state, action.card);
    case "play_treasure":
      if (!action.card) throw new Error("play_treasure requires card");
      return playTreasure(state, action.card);
    case "buy_card":
      if (!action.card) throw new Error("buy_card requires card");
      return buyCard(state, action.card);
    case "end_phase":
      return state.phase === "action" ? endActionPhase(state) : endBuyPhase(state);
    case "discard_cards":
      if (!action.cards || action.cards.length === 0) {
        throw new Error("discard_cards requires cards array");
      }
      // Validate this action is responding to a pendingDecision
      if (!state.pendingDecision || state.pendingDecision.type !== "discard") {
        throw new Error("discard_cards action but no pending discard decision");
      }
      return resolveDecision(state, action.cards);
    case "trash_cards":
      if (!action.cards || action.cards.length === 0) {
        throw new Error("trash_cards requires cards array");
      }
      // Validate this action is responding to a pendingDecision
      if (!state.pendingDecision || state.pendingDecision.type !== "trash") {
        throw new Error("trash_cards action but no pending trash decision");
      }
      return resolveDecision(state, action.cards);
    case "gain_card":
      if (!action.card) {
        throw new Error("gain_card requires card");
      }
      // Validate this action is responding to a pendingDecision
      if (!state.pendingDecision || state.pendingDecision.type !== "gain") {
        throw new Error("gain_card action but no pending gain decision");
      }
      return resolveDecision(state, [action.card]);
  }
}

export async function advanceGameState(
  currentState: GameState,
  humanChoice?: { selectedCards: string[] },
  provider: ModelProvider = "claude-haiku",
  _logger?: LLMLogger
): Promise<GameState> {
  const modelName = getModelFullName(provider);
  const startTime = performance.now();

  console.log(`\n[${provider}] Requesting atomic action from ${modelName}`, {
    activePlayer: currentState.activePlayer,
    phase: currentState.phase,
    turn: currentState.turn,
    ...(humanChoice && { humanChoice: humanChoice.selectedCards }),
  });

  let action: Action;
  try {
    action = await generateActionViaBackend(provider, currentState, humanChoice);
  } catch (error) {
    console.error(`[${provider}] Backend request failed:`, error);
    throw error;
  }

  const duration = performance.now() - startTime;

  console.log(`[${provider}] Action: ${action.type}${action.type === "play_action" || action.type === "play_treasure" || action.type === "buy_card" || action.type === "gain_card" ? ` (${action.card})` : ""} (${duration.toFixed(0)}ms)`, { action });

  // Execute the action using game engine
  const newState = executeAction(currentState, action);

  return newState;
}

// Consensus system: run multiple LLMs and compare outputs
// Uses early consensus detection - resolves as soon as majority agrees
export async function advanceGameStateWithConsensus(
  currentState: GameState,
  humanChoice?: { selectedCards: string[] },
  providers: ModelProvider[] = ALL_FAST_MODELS,
  logger?: LLMLogger
): Promise<GameState> {
  const overallStart = performance.now();
  const parallelStart = performance.now();

  console.log(`\n🎯 Consensus: Running ${providers.length} models in parallel`, { providers });

  // Emit start event immediately so UI shows new turn
  logger?.({
    type: "consensus-start",
    message: `Starting consensus with ${providers.length} models (k=${Math.max(2, Math.ceil(providers.length / 3))})`,
    data: { providers, totalModels: providers.length, phase: currentState.phase },
  });

  type ModelResult = { provider: ModelProvider; result: Action | null; error: unknown; duration: number };
  type ActionSignature = string;
  type VoteGroup = {
    signature: ActionSignature;
    action: Action;
    voters: ModelProvider[];
    count: number;
  };

  const createActionSignature = (action: Action): ActionSignature => JSON.stringify(action);

  // Track votes as they come in
  const voteGroups = new Map<ActionSignature, VoteGroup>();
  const completedResults: ModelResult[] = [];
  const totalModels = providers.length;
  // Scale k with voter count: need ~1/3 of total as margin
  const aheadByK = Math.max(2, Math.ceil(totalModels / 3));

  // Track which models are still pending
  const pendingModels = new Set<number>();
  const modelStartTimes = new Map<number, number>();

  // Early consensus detection with Promise.race pattern
  const { results, earlyConsensus } = await new Promise<{ results: ModelResult[]; earlyConsensus: VoteGroup | null }>((resolveAll) => {
    let resolved = false;
    let completedCount = 0;

    const checkEarlyConsensus = (): VoteGroup | null => {
      // First-to-ahead-by-k: accept when leader has k more votes than runner-up
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
      const modelName = getModelFullName(provider);
      const modelStart = performance.now();
      const uiStartTime = Date.now();

      // Track this model as pending
      pendingModels.add(index);
      modelStartTimes.set(index, uiStartTime);

      console.log(`[${provider}] Consensus ${index + 1}/${totalModels} requesting action from ${modelName}`);

      // Log model start immediately (use Date.now() for UI compatibility)
      logger?.({
        type: "consensus-model-pending" as any,
        message: `${provider} started`,
        data: { provider, index, startTime: uiStartTime },
      });

      generateActionViaBackend(provider, currentState, humanChoice)
        .then((action) => {
          const modelDuration = performance.now() - modelStart;
          console.log(`[${provider}] ✓ Completed in ${modelDuration.toFixed(0)}ms`);
          // Log model completion
          logger?.({
            type: "consensus-model-complete" as any,
            message: `${provider} completed in ${modelDuration.toFixed(0)}ms`,
            data: { provider, index, duration: modelDuration, action, success: true },
          });
          return { provider, result: action, error: null, duration: modelDuration };
        })
        .catch((error) => {
          const modelDuration = performance.now() - modelStart;
          console.error(`[${provider}] ✗ Failed after ${modelDuration.toFixed(0)}ms:`, error);
          // Log model failure
          logger?.({
            type: "consensus-model-complete" as any,
            message: `${provider} failed after ${modelDuration.toFixed(0)}ms`,
            data: { provider, index, duration: modelDuration, error: String(error), success: false },
          });
          return { provider, result: null, error, duration: modelDuration };
        })
        .then((modelResult) => {
          // Remove from pending
          pendingModels.delete(index);

          if (resolved) return; // Already resolved early

          completedResults.push(modelResult);
          completedCount++;

          // Add to vote tally if successful
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

            // Check for early consensus (ahead-by-k)
            const winner = checkEarlyConsensus();
            if (winner) {
              resolved = true;
              const remaining = totalModels - completedCount;
              const groups = Array.from(voteGroups.values()).sort((a, b) => b.count - a.count);
              const runnerUp = groups[1]?.count ?? 0;
              console.log(`⚡ Ahead-by-${aheadByK} consensus! ${winner.count} vs ${runnerUp} (${remaining} still pending)`);

              // Log aborted events for all pending models
              const nowTime = Date.now();
              for (const pendingIndex of pendingModels) {
                const startTime = modelStartTimes.get(pendingIndex) || nowTime;
                logger?.({
                  type: "consensus-model-aborted" as any,
                  message: `${providers[pendingIndex]} aborted (early consensus)`,
                  data: { provider: providers[pendingIndex], index: pendingIndex, duration: nowTime - startTime },
                });
              }

              resolveAll({ results: completedResults, earlyConsensus: winner });
              return;
            }
          }

          // All done - resolve normally
          if (completedCount === totalModels) {
            resolveAll({ results: completedResults, earlyConsensus: null });
          }
        });
    });
  });

  const parallelDuration = performance.now() - parallelStart;

  // Calculate timing statistics from completed results
  const timings = results.map(r => ({ provider: r.provider, duration: r.duration }));
  const successfulTimings = results.filter(r => !r.error).map(r => ({ provider: r.provider, duration: r.duration }));
  const fastest = successfulTimings.length > 0 ? successfulTimings.reduce((min, t) => t.duration < min.duration ? t : min, successfulTimings[0]) : null;
  const slowest = successfulTimings.length > 0 ? successfulTimings.reduce((max, t) => t.duration > max.duration ? t : max, successfulTimings[0]) : null;
  const avgDuration = successfulTimings.length > 0 ? successfulTimings.reduce((sum, t) => sum + t.duration, 0) / successfulTimings.length : 0;

  const completedCount = results.length;
  const pendingCount = totalModels - completedCount;

  logger?.({
    type: "consensus-compare",
    message: earlyConsensus
      ? `Early consensus in ${parallelDuration.toFixed(0)}ms (${completedCount}/${totalModels} completed, ${pendingCount} skipped)`
      : `All ${totalModels} models finished in ${parallelDuration.toFixed(0)}ms`,
    data: {
      timings: timings.sort((a, b) => a.duration - b.duration),
      parallelDuration,
      fastest,
      slowest,
      avgDuration,
      earlyConsensus: !!earlyConsensus,
      pendingSkipped: pendingCount,
    },
  });

  const votingStart = performance.now();

  // Filter out failed results
  const successfulResults = results.filter(r => r.result !== null && !r.error);

  // If early consensus, use it directly; otherwise check we have results
  if (!earlyConsensus && successfulResults.length === 0) {
    console.error("✗ All models failed to generate actions");
    return runSimpleAITurn(currentState);
  }

  if (!earlyConsensus) {
    console.log(`✓ ${successfulResults.length}/${results.length} models generated actions`, {
      successful: successfulResults.map(r => r.provider),
      failed: results.filter(r => r.error).map(r => r.provider),
    });
  }

  // Use early consensus winner or compute from full results
  const rankedGroups = Array.from(voteGroups.values()).sort((a, b) => b.count - a.count);

  // Validate each action against legal actions
  const legalActions = getLegalActions(currentState);

  // Helper to check if an action is legal
  const isActionValid = (action: Action): boolean => {
    return legalActions.some(legal =>
      legal.type === action.type &&
      (action.card ? legal.card === action.card : true)
    );
  };

  // Log voting results - use early consensus winner if available
  const winner = earlyConsensus || rankedGroups[0];
  const votesConsidered = earlyConsensus ? completedCount : successfulResults.length;
  const consensusStrength = winner.count / votesConsidered;

  const actionDesc = winner.action.type === "play_action" || winner.action.type === "play_treasure" || winner.action.type === "buy_card" || winner.action.type === "gain_card"
    ? `${winner.action.type}(${winner.action.card})`
    : winner.action.type;

  const votingDuration = performance.now() - votingStart;

  // Log any invalid actions
  const invalidActions = rankedGroups.filter(g => !isActionValid(g.action));
  if (invalidActions.length > 0) {
    console.warn(`⚠ ${invalidActions.length} invalid actions proposed:`, invalidActions.map(g => ({
      action: g.action,
      votes: g.count,
      voters: g.voters
    })));
  }

  const runnerUpCount = rankedGroups[1]?.count ?? 0;
  logger?.({
    type: "consensus-voting",
    message: earlyConsensus
      ? `⚡ Ahead-by-${aheadByK}: ${actionDesc} (${winner.count} vs ${runnerUpCount})`
      : `◉ Voting: ${rankedGroups.length} unique actions, winner: ${actionDesc}`,
    data: {
      topResult: {
        action: winner.action,
        votes: winner.count,
        voters: winner.voters,
        totalVotes: totalModels,
        completed: votesConsidered,
        percentage: ((consensusStrength * 100).toFixed(1)) + "%",
        valid: isActionValid(winner.action),
        earlyConsensus: !!earlyConsensus,
      },
      allResults: rankedGroups.map(g => ({
        action: g.action,
        votes: g.count,
        voters: g.voters,
        valid: isActionValid(g.action),
      })),
      votingDuration,
      currentPhase: currentState.phase,
    },
  });

  if (earlyConsensus) {
    console.log(`⚡ Ahead-by-${aheadByK}: ${winner.count} vs ${runnerUpCount} chose ${actionDesc} (${pendingCount} skipped)`);
  } else if (consensusStrength === 1.0) {
    console.log(`◉ Unanimous! All ${votesConsidered} models chose: ${actionDesc}`);
  } else if (consensusStrength >= 0.5) {
    console.log(`◉ Strong consensus: ${winner.count}/${votesConsidered} models chose: ${actionDesc} (${(consensusStrength * 100).toFixed(1)}%)`);
  } else if (rankedGroups.length === votesConsidered) {
    console.warn(`⚠ No consensus: All models chose different actions (picking: ${actionDesc})`);
  } else {
    console.warn(`⚠ Weak consensus: ${winner.count}/${votesConsidered} chose: ${actionDesc} (${(consensusStrength * 100).toFixed(1)}%)`);
  }

  // Execute the plurality winner action
  const executionStart = performance.now();
  const newState = executeAction(currentState, winner.action);
  const executionDuration = performance.now() - executionStart;

  const overallDuration = performance.now() - overallStart;

  console.log(`✓ Consensus complete in ${overallDuration.toFixed(0)}ms${earlyConsensus ? ` (early, ${pendingCount} skipped)` : ""}`, {
    breakdown: {
      total: overallDuration,
      parallel: parallelDuration,
      voting: votingDuration,
      execution: executionDuration,
    },
    earlyConsensus: !!earlyConsensus,
  });

  return newState;
}

// For running multiple AI turns in sequence (when it's AI's turn)
export async function runAITurn(
  state: GameState,
  provider: ModelProvider = "claude-haiku",
  logger?: LLMLogger
): Promise<GameState> {
  console.log(`\n🤖 AI turn ${state.turn} starting...`, { phase: state.phase });

  let currentState = state;
  let stepCount = 0;
  const MAX_STEPS = 20; // Safety limit

  // Keep advancing until it's human's turn or game over
  while (
    currentState.activePlayer === "ai" &&
    !currentState.gameOver &&
    !currentState.pendingDecision &&
    stepCount < MAX_STEPS
  ) {
    stepCount++;

    try {
      currentState = await advanceGameState(currentState, undefined, provider, logger);

      // Check if AI incorrectly set a pendingDecision
      if (currentState.pendingDecision && currentState.pendingDecision.player === "ai") {
        console.warn("⚠ AI incorrectly set pendingDecision - clearing it");
        currentState = {
          ...currentState,
          pendingDecision: null,
        };
      }
    } catch (error) {
      console.error("Error during AI turn:", error);
      return currentState;
    }
  }

  if (stepCount >= MAX_STEPS) {
    console.warn(`⚠ AI turn exceeded ${MAX_STEPS} steps - stopping to prevent infinite loop`);
  }

  if (currentState.pendingDecision) {
    console.log(`⚠ AI turn ended with pendingDecision: ${currentState.pendingDecision.type}`);
  }

  console.log(`✓ AI turn complete after ${stepCount} steps`, {
    phase: currentState.phase,
    turn: currentState.turn,
    activePlayer: currentState.activePlayer,
  });

  return currentState;
}

// Consensus version of runAITurn
export async function runAITurnWithConsensus(
  state: GameState,
  providers: ModelProvider[] = ALL_FAST_MODELS,
  logger?: LLMLogger,
  onStateChange?: (state: GameState) => void
): Promise<GameState> {
  console.log(`\n🤖 AI turn ${state.turn} starting (Consensus Mode with ${providers.length} models)`, { phase: state.phase });

  logger?.({
    type: "ai-turn-start",
    message: `AI turn ${state.turn} starting`,
    data: { phase: state.phase, turn: state.turn, providers },
  });

  let currentState = state;
  let stepCount = 0;
  const MAX_STEPS = 20; // Safety limit

  // Keep advancing until it's human's turn or game over
  while (
    currentState.activePlayer === "ai" &&
    !currentState.gameOver &&
    !currentState.pendingDecision &&
    stepCount < MAX_STEPS
  ) {
    stepCount++;
    console.log(`\n--- Consensus Step ${stepCount} ---`);

    try {
      currentState = await advanceGameStateWithConsensus(currentState, undefined, providers, logger);

      // Check if AI incorrectly set a pendingDecision
      if (currentState.pendingDecision && currentState.pendingDecision.player === "ai") {
        console.warn("⚠ AI incorrectly set pendingDecision - clearing it");
        currentState = {
          ...currentState,
          pendingDecision: null,
        };
      }

      // Update UI incrementally
      onStateChange?.(currentState);
    } catch (error) {
      console.error("Error during consensus step:", error);
      return currentState;
    }
  }

  if (stepCount >= MAX_STEPS) {
    console.warn(`⚠ AI turn exceeded ${MAX_STEPS} steps - stopping to prevent infinite loop`);
  }

  console.log(`✓ Consensus AI turn complete after ${stepCount} steps`, {
    phase: currentState.phase,
    turn: currentState.turn,
    activePlayer: currentState.activePlayer,
  });

  return currentState;
}
