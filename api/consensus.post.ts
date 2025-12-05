import { start } from "workflow/api";
import { defineEventHandler, readBody, createError } from "nitro/h3";
import { consensusWorkflow } from "../workflows/generate-action";
import type { GameState } from "../src/types/game-state";
import type { Action } from "../src/types/action";
import type { ModelProvider } from "../src/config/models";

interface RequestBody {
  providers: ModelProvider[];
  currentState: GameState;
  legalActions: Action[];
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event);

  if (!body.providers || !body.currentState) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing required fields: providers, currentState",
    });
  }

  const { providers, currentState, legalActions } = body;

  // Start the durable consensus workflow
  const run = await start(consensusWorkflow, [
    providers,
    currentState,
    legalActions || [],
  ]);

  // Wait for the result
  const result = await run.returnValue;

  return result;
});
