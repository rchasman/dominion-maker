import type { GameState } from "../types/game-state";
import { getCardEffect } from "../cards/base";
import { runExecution, type ExecutionResponse } from "./execute";
import { executionStackSchema } from "./execution-schema";
import { validateCheckpoint } from "./validate-checkpoint";

/** Validate the saved work and offered choice before executing an answer. */
export function resumeExecution(
  state: GameState,
  response: ExecutionResponse,
  random: () => number = Math.random,
) {
  if (!state.executionStack?.length)
    throw new Error("Missing execution checkpoint");
  const stack = executionStackSchema.parse(state.executionStack);
  for (const frame of stack) {
    if (frame.type === "choice" || frame.type === "continue") {
      const effect = getCardEffect(frame.card);
      if (!effect) throw new Error(`No saved choice handler for ${frame.card}`);
      effect.parseMemory(frame.memory);
    }
  }
  validateCheckpoint(state, stack, response);
  return runExecution(state, stack, random, response);
}
