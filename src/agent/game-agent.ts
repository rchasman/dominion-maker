import { generateObject, createGateway } from "ai";
import { GameState } from "../types/game-state";
import { Action } from "../types/action";
import { DOMINION_SYSTEM_PROMPT } from "./system-prompt";
import type { LLMLogEntry } from "../components/LLMLog";
import {
  playAction,
  playTreasure,
  buyCard,
  endActionPhase,
  endBuyPhase,
  runSimpleAITurn,
} from "../lib/game-engine";

// Model configuration - verified working models through Vercel AI Gateway
export type ModelProvider =
  | "claude-haiku"
  | "claude-sonnet"
  | "deepseek-v32"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "deepseek-chat";

// Default: 10 fast model instances for maximum consensus (duplicates allowed)
export const ALL_FAST_MODELS: ModelProvider[] = [
  "claude-haiku",
  "gpt-4o-mini",
  "claude-haiku",
  "deepseek-v32",
  "gpt-4o-mini",
  "claude-sonnet",
  "deepseek-chat",
  "gpt-4o",
  "claude-haiku",
  "gpt-4o-mini",
];

// Logger type for capturing LLM activity
export type LLMLogger = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => void;

// Configure AI Gateway - single endpoint for all models
const gateway = createGateway({
  apiKey: import.meta.env.VITE_AI_GATEWAY_API_KEY || "",
});

function getModelName(provider: ModelProvider): string {
  switch (provider) {
    case "claude-haiku":
      return "anthropic/claude-haiku-4.5";
    case "claude-sonnet":
      return "anthropic/claude-sonnet-4.5";
    case "deepseek-v32":
      return "deepseek/deepseek-v3.2";
    case "gpt-4o-mini":
      return "openai/gpt-4o-mini";
    case "gpt-4o":
      return "openai/gpt-4o";
    case "deepseek-chat":
      return "deepseek/deepseek-chat";
  }
}

function getModel(provider: ModelProvider) {
  return gateway(getModelName(provider));
}

// Execute an atomic action and return new state
function executeAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "play_action":
      return playAction(state, action.card);
    case "play_treasure":
      return playTreasure(state, action.card);
    case "buy_card":
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

  logger?.({
    type: "llm-call-start",
    message: `Calling ${provider} (${modelName})`,
    data: {
      activePlayer: currentState.activePlayer,
      phase: currentState.phase,
      turn: currentState.turn,
      ...(humanChoice && { humanChoice: humanChoice.selectedCards }),
    },
  });

  const model = getModel(provider);

  const userMessage = humanChoice
    ? `Current state:\n${JSON.stringify(currentState, null, 2)}\n\nHuman chose: ${JSON.stringify(humanChoice.selectedCards)}\n\nWhat is the next atomic action?`
    : `Current state:\n${JSON.stringify(currentState, null, 2)}\n\nWhat is the next atomic action for ${currentState.activePlayer}?`;

  const startTime = performance.now();

  console.log(`\n[${provider}] Requesting atomic action from ${modelName}`);

  let result;
  try {
    const isAnthropic = provider.startsWith("claude");
    result = await generateObject({
      model,
      schema: Action,
      system: DOMINION_SYSTEM_PROMPT,
      prompt: userMessage,
      ...(isAnthropic && {
        providerOptions: {
          anthropic: {
            structuredOutputMode: "auto",
          },
        },
      }),
    });
  } catch (error) {
    console.error(`[${provider}] generateObject failed:`, error);
    logger?.({
      type: "error",
      message: `generateObject failed: ${error instanceof Error ? error.message : String(error)}`,
      data: { provider },
    });
    throw error;
  }

  const duration = performance.now() - startTime;
  const action = result.object;

  logger?.({
    type: "llm-call-end",
    message: `Action: ${action.type}${action.type === "play_action" || action.type === "play_treasure" || action.type === "buy_card" || action.type === "gain_card" ? ` (${action.card})` : ""} (${duration.toFixed(0)}ms)`,
    data: { action },
  });

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
  logger?.({
    type: "consensus-start",
    message: `Running ${providers.length} models in parallel for consensus`,
    data: { providers },
  });

  const startTime = performance.now();

  // Run all models in parallel WITHOUT individual validation
  // (we'll validate the consensus result)
  const promises = providers.map(async (provider, index) => {
    const model = getModel(provider);
    const modelName = getModelName(provider);

    const userMessage = humanChoice
      ? `Current state:\n${JSON.stringify(currentState, null, 2)}\n\nHuman chose: ${JSON.stringify(humanChoice.selectedCards)}\n\nWhat is the next atomic action?`
      : `Current state:\n${JSON.stringify(currentState, null, 2)}\n\nWhat is the next atomic action for ${currentState.activePlayer}?`;

    logger?.({
      type: "llm-call-start",
      message: `Model ${index + 1}/${providers.length}: ${provider} (${modelName})`,
    });

    console.log(`\n[${provider}] Consensus ${index + 1}/${providers.length} requesting action from ${modelName}`);

    try {
      const isAnthropic = provider.startsWith("claude");
      const result = await generateObject({
        model,
        schema: Action,
        system: DOMINION_SYSTEM_PROMPT,
        prompt: userMessage,
        ...(isAnthropic && {
          providerOptions: {
            anthropic: {
              structuredOutputMode: "auto",
            },
          },
        }),
      });

      return { provider, result: result.object, error: null };
    } catch (error) {
      console.error(`[${provider}] Consensus call failed:`, error);
      logger?.({
        type: "error",
        message: `${provider} failed: ${error instanceof Error ? error.message : String(error)}`,
        data: { provider },
      });
      return { provider, result: null, error };
    }
  });

  const results = await Promise.all(promises);
  const duration = performance.now() - startTime;

  logger?.({
    type: "consensus-compare",
    message: `Comparing ${results.length} results (${duration.toFixed(0)}ms total)`,
  });

  // Filter out failed results
  const successfulResults = results.filter(r => r.result !== null && !r.error);

  if (successfulResults.length === 0) {
    logger?.({
      type: "error",
      message: "✗ All models failed to generate actions",
    });
    return runSimpleAITurn(currentState);
  }

  logger?.({
    type: "consensus-validation",
    message: `✓ ${successfulResults.length}/${results.length} models generated actions`,
    data: {
      successful: successfulResults.map(r => r.provider),
      failed: results.filter(r => r.error).map(r => r.provider),
    },
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

  // Log voting results
  const winner = rankedGroups[0];
  const consensusStrength = winner.count / successfulResults.length;

  const actionDesc = winner.action.type === "play_action" || winner.action.type === "play_treasure" || winner.action.type === "buy_card" || winner.action.type === "gain_card"
    ? `${winner.action.type}(${winner.action.card})`
    : winner.action.type;

  logger?.({
    type: "consensus-voting",
    message: `◉ Voting: ${rankedGroups.length} unique actions, winner: ${actionDesc}`,
    data: {
      topResult: {
        action: winner.action,
        votes: winner.count,
        voters: winner.voters,
        totalVotes: successfulResults.length,
        percentage: ((consensusStrength * 100).toFixed(1)) + "%",
      },
      allResults: rankedGroups.map(g => ({
        action: g.action,
        votes: g.count,
        voters: g.voters,
      })),
    },
  });

  if (consensusStrength === 1.0) {
    logger?.({
      type: "consensus-success",
      message: `◉ Unanimous! All ${successfulResults.length} models chose: ${actionDesc}`,
    });
  } else if (consensusStrength >= 0.5) {
    logger?.({
      type: "consensus-success",
      message: `◉ Strong consensus: ${winner.count}/${successfulResults.length} models chose: ${actionDesc} (${(consensusStrength * 100).toFixed(1)}%)`,
    });
  } else if (rankedGroups.length === successfulResults.length) {
    logger?.({
      type: "warning",
      message: `⚠ No consensus: All models chose different actions (picking: ${actionDesc})`,
    });
  } else {
    logger?.({
      type: "warning",
      message: `⚠ Weak consensus: ${winner.count}/${successfulResults.length} chose: ${actionDesc} (${(consensusStrength * 100).toFixed(1)}%)`,
    });
  }

  // Execute the plurality winner action
  const newState = executeAction(currentState, winner.action);
  return newState;
}

// For running multiple AI turns in sequence (when it's AI's turn)
export async function runAITurn(
  state: GameState,
  provider: ModelProvider = "claude-haiku",
  logger?: LLMLogger
): Promise<GameState> {
  logger?.({
    type: "ai-turn-start",
    message: `AI turn ${state.turn} starting...`,
    data: { phase: state.phase, turn: state.turn },
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

    try {
      currentState = await advanceGameState(currentState, undefined, provider, logger);

      // Check if AI incorrectly set a pendingDecision
      if (currentState.pendingDecision && currentState.pendingDecision.player === "ai") {
        logger?.({
          type: "warning",
          message: "AI incorrectly set pendingDecision - clearing it",
        });
        currentState = {
          ...currentState,
          pendingDecision: null,
        };
      }
    } catch (error) {
      logger?.({
        type: "error",
        message: `Error during AI turn: ${error instanceof Error ? error.message : String(error)}`,
      });
      return currentState;
    }
  }

  if (stepCount >= MAX_STEPS) {
    logger?.({
      type: "warning",
      message: `AI turn exceeded ${MAX_STEPS} steps - stopping to prevent infinite loop`,
    });
  }

  if (currentState.pendingDecision) {
    logger?.({
      type: "warning",
      message: `AI turn ended with pendingDecision: ${currentState.pendingDecision.type}`,
      data: { pendingDecision: currentState.pendingDecision.type },
    });
  }

  logger?.({
    type: "ai-turn-end",
    message: `AI turn complete after ${stepCount} steps`,
    data: {
      steps: stepCount,
      phase: currentState.phase,
      turn: currentState.turn,
      activePlayer: currentState.activePlayer,
    },
  });

  return currentState;
}

// Consensus version of runAITurn
export async function runAITurnWithConsensus(
  state: GameState,
  providers: ModelProvider[] = ALL_FAST_MODELS,
  logger?: LLMLogger
): Promise<GameState> {
  logger?.({
    type: "ai-turn-start",
    message: `AI turn ${state.turn} starting (Consensus Mode with ${providers.length} models)`,
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
    logger?.({
      type: "consensus-step",
      message: `Consensus Step ${stepCount}`,
    });

    try {
      currentState = await advanceGameStateWithConsensus(currentState, undefined, providers, logger);

      // Check if AI incorrectly set a pendingDecision
      if (currentState.pendingDecision && currentState.pendingDecision.player === "ai") {
        logger?.({
          type: "warning",
          message: "AI incorrectly set pendingDecision - clearing it",
        });
        currentState = {
          ...currentState,
          pendingDecision: null,
        };
      }
    } catch (error) {
      console.error("Error during consensus step:", error);
      logger?.({
        type: "error",
        message: `Error during consensus step: ${error instanceof Error ? error.message : String(error)}`,
      });
      return currentState;
    }
  }

  if (stepCount >= MAX_STEPS) {
    logger?.({
      type: "warning",
      message: `AI turn exceeded ${MAX_STEPS} steps - stopping to prevent infinite loop`,
    });
  }

  logger?.({
    type: "ai-turn-end",
    message: `Consensus AI turn complete after ${stepCount} steps`,
    data: {
      steps: stepCount,
      phase: currentState.phase,
      turn: currentState.turn,
      activePlayer: currentState.activePlayer,
    },
  });

  return currentState;
}
