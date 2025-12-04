import { generateObject, createGateway } from "ai";
import { GameState } from "./src/types/game-state";
import { Action } from "./src/types/action";
import { DOMINION_SYSTEM_PROMPT } from "./src/agent/system-prompt";
import { MODEL_MAP } from "./src/config/models";
import { buildStrategicContext } from "./src/agent/strategic-context";

const PORT = 5174;

// Configure AI Gateway with server-side API key
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
});

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Handle POST /api/generate-action
    if (req.method === "POST" && new URL(req.url).pathname === "/api/generate-action") {
      try {
        const body = await req.json();
        const { provider, currentState, humanChoice, legalActions } = body;

        const modelName = MODEL_MAP[provider];
        if (!modelName) {
          return Response.json({ error: "Invalid provider" }, { status: 400 });
        }

        const model = gateway(modelName);
        const isAnthropic = provider.startsWith("claude");

        const legalActionsStr = legalActions && legalActions.length > 0
          ? `\n\nLEGAL ACTIONS (you MUST choose one of these):\n${JSON.stringify(legalActions, null, 2)}`
          : "";

        const turnHistoryStr = currentState.turnHistory && currentState.turnHistory.length > 0
          ? `\n\nACTIONS TAKEN THIS TURN (so far):\n${JSON.stringify(currentState.turnHistory, null, 2)}`
          : "";

        // Build strategic context - human-readable game analysis
        const strategicContext = buildStrategicContext(currentState);

        // Build appropriate prompt based on whether there's a pending decision
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
          maxRetries: 0, // Disable retries - let frontend handle consensus failures
          abortSignal: AbortSignal.timeout(15000), // 15s timeout per model
          ...(isAnthropic && {
            providerOptions: {
              anthropic: {
                structuredOutputMode: "auto",
              },
            },
          }),
        });

        return Response.json(
          { action: result.object },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      } catch (error) {
        console.error("Error generating action:", error);
        return Response.json(
          { error: error instanceof Error ? error.message : "Unknown error" },
          {
            status: 500,
            headers: {
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`AI Gateway proxy server running on http://localhost:${PORT}`);
