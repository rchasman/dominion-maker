import { start } from "workflow/api";
import { defineEventHandler, readBody, createError } from "nitro/h3";
import { generateActionWorkflow } from "../workflows/generate-action";
import type { GameState } from "../src/types/game-state";
import type { Action } from "../src/types/action";
import type { ModelProvider } from "../src/config/models";

interface RequestBody {
  provider: ModelProvider;
  currentState: GameState;
  humanChoice?: { selectedCards: string[] };
  legalActions: Action[];
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event);

  if (!body.provider || !body.currentState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing required fields: provider, currentState",
    });
  }

  const { provider, currentState, humanChoice, legalActions } = body;

  // Start the durable workflow
  const run = await start(generateActionWorkflow, [
    provider,
    currentState,
    legalActions || [],
    humanChoice,
  ]);

  // Wait for the result
  const result = await run.returnValue;

  return result;
});
