import { generateObject, createGateway } from "ai";
import { defineEventHandler, readBody, createError } from "nitro/h3";
import type { GameState } from "../src/types/game-state";
import { Action } from "../src/types/action";
import type { ModelProvider } from "../src/config/models";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP } from "../src/config/models";
import { buildStrategicContext } from "../src/agent/strategic-context";

// Configure AI Gateway with server-side API key
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
});

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

  const modelName = MODEL_MAP[provider];
  if (!modelName) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid provider",
    });
  }

  const model = gateway(modelName);
  const isAnthropic = provider.startsWith("claude");

  const legalActionsStr = legalActions && legalActions.length > 0
    ? `\n\nLEGAL ACTIONS (you MUST choose one of these):\n${JSON.stringify(legalActions, null, 2)}`
    : "";

  const turnHistoryStr = currentState.turnHistory && currentState.turnHistory.length > 0
    ? `\n\nACTIONS TAKEN THIS TURN (so far):\n${JSON.stringify(currentState.turnHistory, null, 2)}`
    : "";

  const strategicContext = buildStrategicContext(currentState);

  let promptQuestion: string;
  if (currentState.pendingDecision) {
    const decision = currentState.pendingDecision;
    promptQuestion = `${decision.player.toUpperCase()} must respond to: ${decision.prompt}\nWhat action should ${decision.player} take?`;
  } else {
    promptQuestion = `What is the next atomic action for ${currentState.activePlayer}?`;
  }

  const userMessage = humanChoice
    ? `${strategicContext}\n\nCurrent state:\n${JSON.stringify(currentState, null, 2)}${turnHistoryStr}\n\nHuman chose: ${JSON.stringify(humanChoice.selectedCards)}${legalActionsStr}\n\n${promptQuestion}`
    : `${strategicContext}\n\nCurrent state:\n${JSON.stringify(currentState, null, 2)}${turnHistoryStr}${legalActionsStr}\n\n${promptQuestion}`;

  const result = await generateObject({
    model,
    schema: Action,
    system: DOMINION_SYSTEM_PROMPT,
    prompt: userMessage,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(15000),
    ...(isAnthropic && {
      providerOptions: {
        anthropic: {
          structuredOutputMode: "auto",
        },
      },
    }),
  });

  return { action: result.object };
});
