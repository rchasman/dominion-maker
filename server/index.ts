import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { opentelemetry } from "@elysiajs/opentelemetry";
import { serverTiming } from "@elysiajs/server-timing";
import { generateObject, generateText, createGateway } from "ai";
import { ActionSchema } from "../src/types/action";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP } from "../src/config/models";
import { buildStrategicContext } from "../src/agent/strategic-context";
import { GameState, HumanChoice } from "../src/types/game-state";
import type { Action } from "../src/types/action";
import { z } from "zod";

// Request body schema
const GenerateActionRequestSchema = z.object({
  provider: z.string(),
  currentState: GameState,
  humanChoice: HumanChoice.optional(),
  legalActions: z.array(ActionSchema).optional(),
});

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
      // Ministral struggles with generateObject - use generateText with explicit JSON instructions
      const isMistral = provider.includes("ministral");

      if (isMistral) {
        const jsonPrompt = `${userMessage}\n\nRespond with ONLY a JSON object matching this exact format (no schema, no explanation):\n{\n  "type": "play_action" | "play_treasure" | "buy_card" | "end_phase" | "discard_cards" | "trash_cards" | "gain_card",\n  "card": "CardName" (optional),\n  "cards": ["CardName"] (optional),\n  "reasoning": "brief explanation" (optional)\n}`;

        const result = await generateText({
          model,
          system: DOMINION_SYSTEM_PROMPT,
          prompt: jsonPrompt,
          maxRetries: 0,
        });

        // Extract JSON from text (may be wrapped in markdown code blocks)
        let text = result.text.trim();

        // Remove markdown code blocks if present
        if (text.startsWith('```')) {
          const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (match) {
            text = match[1].trim();
          }
        }

        let jsonStr = text;

        // If there are multiple JSON objects, try to find the action (not schema)
        if (text.includes('}\n') || text.includes('}\r\n')) {
          const chunks = text.split(/\n\n+/);
          for (const chunk of chunks) {
            const trimmed = chunk.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
              try {
                const parsed = JSON.parse(trimmed);
                // Skip if it's a schema
                if (parsed.properties || (parsed.type === "object" && parsed.description)) {
                  continue;
                }
                // Found a candidate action
                if (parsed.type && typeof parsed.type === "string" && parsed.type !== "object") {
                  jsonStr = trimmed;
                  break;
                }
              } catch {
                continue;
              }
            }
          }
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const action = ActionSchema.parse(parsed);
          return { action };
        } catch (parseErr) {
          const errorMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
          console.error(`[${provider}] Failed to parse JSON response`);
          console.error(`Full response text:`, result.text);
          console.error(`Extracted JSON string:`, jsonStr);
          throw new Error(`Failed to parse Ministral response: ${errorMessage}\nFull text: ${result.text}`);
        }
      }

      // Use generateObject for other models
      const result = await generateObject({
        model,
        schema: ActionSchema,
        system: DOMINION_SYSTEM_PROMPT,
        prompt: userMessage,
        maxRetries: 0,
        ...(isAnthropic && {
          providerOptions: {
            anthropic: {
              structuredOutputMode: "outputFormat",
            },
          },
        }),
      });

      return { action: result.object };
    } catch (err) {
      // Ministral sometimes echoes the schema before/instead of the actual JSON
      // Try to extract and parse just the actual response object
      const errorWithText = err as { text?: string };
      if (errorWithText.text && provider === "ministral-3b") {
        try {
          const text = errorWithText.text;
          // Split by double newlines and try parsing each chunk
          const chunks = text.split(/\n\n+/);
          for (let i = chunks.length - 1; i >= 0; i--) {
            const chunk = chunks[i].trim();
            if (chunk.startsWith("{") && chunk.endsWith("}")) {
              try {
                const parsed = JSON.parse(chunk);
                // Reject if it's a schema (has properties/description/required at root)
                if (parsed.properties || parsed.description && parsed.required) {
                  continue;
                }
                // Validate it's an action with 'type' being a string (not "object")
                if (parsed.type && typeof parsed.type === "string" && parsed.type !== "object") {
                  const validated = ActionSchema.parse(parsed);
                  console.log(`[${provider}] Recovered from schema echo, extracted valid action`);
                  return { action: validated };
                }
              } catch {
                continue;
              }
            }
          }
        } catch (recoveryErr) {
          console.error(`[${provider}] Recovery attempt failed:`, recoveryErr);
        }
      }

      const error = err as Error & { cause?: unknown; text?: string };
      console.error(`[${provider}] Error generating action:`, error.message);
      if (error.cause) {
        console.error("Cause:", error.cause);
      }
      if (error.text) {
        console.error("Response text:", error.text);
      }

      // For Ministral, return error instead of throwing to allow consensus to continue
      if (provider === "ministral-3b") {
        return { error: 500, message: `Model failed: ${error.message}` };
      }

      throw err;
    }
  }, {
    body: GenerateActionRequestSchema
  });

// For local development
if (import.meta.main) {
  app.listen(5174);
  console.log(`🦊 Elysia server running at http://${app.server?.hostname}:${app.server?.port}`);
}

// For Vercel deployment
export default app;

export type App = typeof app;
