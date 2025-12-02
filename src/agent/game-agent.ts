import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { GameState } from "../types/game-state";
import { DOMINION_SYSTEM_PROMPT } from "./system-prompt";

// Model configuration - easily swappable
export type ModelProvider = "openai" | "anthropic";

const openai = createOpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

function getModel(provider: ModelProvider) {
  switch (provider) {
    case "openai":
      return openai("gpt-4o");
    case "anthropic":
      return anthropic("claude-sonnet-4-20250514");
  }
}

export async function advanceGameState(
  currentState: GameState,
  humanChoice?: { selectedCards: string[] },
  provider: ModelProvider = "openai"
): Promise<GameState> {
  const model = getModel(provider);

  const userMessage = humanChoice
    ? `Current state:\n${JSON.stringify(currentState, null, 2)}\n\nHuman chose: ${JSON.stringify(humanChoice.selectedCards)}`
    : `Current state:\n${JSON.stringify(currentState, null, 2)}\n\nAdvance to next state.`;

  const result = await generateObject({
    model,
    schema: GameState,
    system: DOMINION_SYSTEM_PROMPT,
    prompt: userMessage,
  });

  return result.object;
}

// For running multiple AI turns in sequence (when it's AI's turn)
export async function runAITurn(
  state: GameState,
  provider: ModelProvider = "openai"
): Promise<GameState> {
  let currentState = state;

  // Keep advancing until it's human's turn or game over
  while (
    currentState.activePlayer === "ai" &&
    !currentState.gameOver &&
    !currentState.pendingDecision
  ) {
    currentState = await advanceGameState(currentState, undefined, provider);
  }

  return currentState;
}
