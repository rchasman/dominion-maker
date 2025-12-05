import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { serverTiming } from "@elysiajs/server-timing";
import { generateObject, createGateway } from "ai";
import type { GameState } from "../src/types/game-state";
import type { Action } from "../src/types/action";
import { ActionSchema } from "../src/types/action";
import type { ModelProvider } from "../src/config/models";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP } from "../src/config/models";
import { buildStrategicContext } from "../src/agent/strategic-context";

// Configure AI Gateway with server-side API key
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
});

const app = new Elysia()
  .use(cors())
  .use(opentelemetry())
  .use(serverTiming())
  .post("/api/generate-action", async ({ body, error }) => {
    const { provider, currentState, humanChoice, legalActions } = body;

    if (!provider || !currentState) {
      return error(400, "Missing required fields: provider, currentState");
    }

    const modelName = MODEL_MAP[provider];
    if (!modelName) {
      return error(400, "Invalid provider");
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

    try {
      const result = await generateObject({
        model,
        schema: ActionSchema,
        system: DOMINION_SYSTEM_PROMPT,
        prompt: userMessage,
        maxRetries: 0,
        ...(isAnthropic && {
          providerOptions: {
            anthropic: {
              structuredOutputMode: "auto",
            },
          },
        }),
      });

      return { action: result.object };
    } catch (err: any) {
      console.error(`[${provider}] Error generating action:`, err.message);
      if (err.cause) {
        console.error("Cause:", err.cause);
      }
      if (err.text) {
        console.error("Response text:", err.text);
      }
      throw err;
    }
  })
  .listen(5174);

console.log(`🦊 Elysia server running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
