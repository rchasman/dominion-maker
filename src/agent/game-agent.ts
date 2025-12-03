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
} from "../lib/game-engine";

// Backend API endpoint
const API_URL = "http://localhost:5174/api/generate-action";

// Model configuration - verified working models through Vercel AI Gateway
export type ModelProvider =
  | "claude-haiku"
  | "claude-sonnet"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gemini-2.5-flash-lite"
  | "ministral-3b";

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

// Logger type for capturing LLM activity
export type LLMLogger = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => void;

function getModelName(provider: ModelProvider): string {
  switch (provider) {
    case "claude-haiku":
      return "anthropic/claude-haiku-4.5";
    case "claude-sonnet":
      return "anthropic/claude-sonnet-4.5";
    case "gpt-4o-mini":
      return "openai/gpt-4o-mini";
    case "gpt-4o":
      return "openai/gpt-4o";
    case "gemini-2.5-flash-lite":
      return "google/gemini-2.5-flash-lite";
    case "ministral-3b":
      return "mistral/ministral-3b";
  }
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
    case "trash_cards":
    case "gain_card":
      // TODO: implement when needed
      return state;
  }
}

export async function advanceGameState(
  currentState: GameState,
  humanChoice?: { selectedCards: string[] },
  provider: ModelProvider = "claude-haiku",
  logger?: LLMLogger
): Promise<GameState> {
  const modelName = getModelName(provider);
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
export async function advanceGameStateWithConsensus(
  currentState: GameState,
  humanChoice?: { selectedCards: string[] },
  providers: ModelProvider[] = ALL_FAST_MODELS,
  logger?: LLMLogger
): Promise<GameState> {
  const overallStart = performance.now();
  const parallelStart = performance.now();

  console.log(`\n🎯 Consensus: Running ${providers.length} models in parallel`, { providers });

  // Run all models in parallel via backend API with per-model timing
  const promises = providers.map(async (provider, index) => {
    const modelName = getModelName(provider);
    const modelStart = performance.now();

    console.log(`[${provider}] Consensus ${index + 1}/${providers.length} requesting action from ${modelName}`);

    try {
      const action = await generateActionViaBackend(provider, currentState, humanChoice);
      const modelDuration = performance.now() - modelStart;
      console.log(`[${provider}] ✓ Completed in ${modelDuration.toFixed(0)}ms`);
      return { provider, result: action, error: null, duration: modelDuration };
    } catch (error) {
      const modelDuration = performance.now() - modelStart;
      console.error(`[${provider}] ✗ Failed after ${modelDuration.toFixed(0)}ms:`, error);
      return { provider, result: null, error, duration: modelDuration };
    }
  });

  const results = await Promise.all(promises);
  const parallelDuration = performance.now() - parallelStart;

  // Calculate timing statistics
  const timings = results.map(r => ({ provider: r.provider, duration: r.duration }));
  const successfulTimings = results.filter(r => !r.error).map(r => ({ provider: r.provider, duration: r.duration }));
  const fastest = successfulTimings.reduce((min, t) => t.duration < min.duration ? t : min, successfulTimings[0]);
  const slowest = successfulTimings.reduce((max, t) => t.duration > max.duration ? t : max, successfulTimings[0]);
  const avgDuration = successfulTimings.reduce((sum, t) => sum + t.duration, 0) / successfulTimings.length;

  logger?.({
    type: "consensus-compare",
    message: `All models finished in ${parallelDuration.toFixed(0)}ms (fastest: ${fastest?.provider} ${fastest?.duration.toFixed(0)}ms, slowest: ${slowest?.provider} ${slowest?.duration.toFixed(0)}ms, avg: ${avgDuration.toFixed(0)}ms)`,
    data: {
      timings: timings.sort((a, b) => a.duration - b.duration),
      parallelDuration,
      fastest,
      slowest,
      avgDuration
    },
  });

  const votingStart = performance.now();

  // Filter out failed results
  const successfulResults = results.filter(r => r.result !== null && !r.error);

  if (successfulResults.length === 0) {
    console.error("✗ All models failed to generate actions");
    return runSimpleAITurn(currentState);
  }

  console.log(`✓ ${successfulResults.length}/${results.length} models generated actions`, {
    successful: successfulResults.map(r => r.provider),
    failed: results.filter(r => r.error).map(r => r.provider),
  });

  // MAKER voting: Group actions and pick plurality winner
  type ActionSignature = string;
  type VoteGroup = {
    signature: ActionSignature;
    action: Action;
    voters: ModelProvider[];
    count: number;
  };

  // Create signature for each action (simple JSON stringify)
  function createActionSignature(action: Action): ActionSignature {
    return JSON.stringify(action);
  }

  // Group results by action signature
  const voteGroups = new Map<ActionSignature, VoteGroup>();

  for (const { provider, result } of successfulResults) {
    const signature = createActionSignature(result!);
    const existing = voteGroups.get(signature);

    if (existing) {
      existing.voters.push(provider);
      existing.count++;
    } else {
      voteGroups.set(signature, {
        signature,
        action: result!,
        voters: [provider],
        count: 1,
      });
    }
  }

  // Sort by vote count (descending) to get top-k
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

  // Log voting results
  const winner = rankedGroups[0];
  const consensusStrength = winner.count / successfulResults.length;

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

  logger?.({
    type: "consensus-voting",
    message: `◉ Voting: ${rankedGroups.length} unique actions, winner: ${actionDesc} (voting: ${votingDuration.toFixed(0)}ms)`,
    data: {
      topResult: {
        action: winner.action,
        votes: winner.count,
        voters: winner.voters,
        totalVotes: successfulResults.length,
        percentage: ((consensusStrength * 100).toFixed(1)) + "%",
        valid: isActionValid(winner.action),
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

  if (consensusStrength === 1.0) {
    console.log(`◉ Unanimous! All ${successfulResults.length} models chose: ${actionDesc}`);
  } else if (consensusStrength >= 0.5) {
    console.log(`◉ Strong consensus: ${winner.count}/${successfulResults.length} models chose: ${actionDesc} (${(consensusStrength * 100).toFixed(1)}%)`);
  } else if (rankedGroups.length === successfulResults.length) {
    console.warn(`⚠ No consensus: All models chose different actions (picking: ${actionDesc})`);
  } else {
    console.warn(`⚠ Weak consensus: ${winner.count}/${successfulResults.length} chose: ${actionDesc} (${(consensusStrength * 100).toFixed(1)}%)`);
  }

  // Execute the plurality winner action
  const executionStart = performance.now();
  const newState = executeAction(currentState, winner.action);
  const executionDuration = performance.now() - executionStart;

  const overallDuration = performance.now() - overallStart;

  console.log(`✓ Consensus complete in ${overallDuration.toFixed(0)}ms`, {
    breakdown: {
      total: overallDuration,
      parallel: parallelDuration,
      voting: votingDuration,
      execution: executionDuration,
    },
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
  logger?: LLMLogger
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
