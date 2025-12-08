import { generateObject, generateText, createGateway } from "ai";
import { ActionSchema } from "../src/types/action";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP } from "../src/config/models";
import { buildStrategicContext } from "../src/agent/strategic-context";

// Configure AI Gateway with server-side API key
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
});

// Debug logging for deployment
if (!process.env.AI_GATEWAY_API_KEY) {
  console.error("⚠️  AI_GATEWAY_API_KEY is not set!");
} else {
  console.log("✓ AI_GATEWAY_API_KEY is configured");
}

export default async function handler(req: Request) {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  let provider: string = "";

  try {
    body = await req.json() as { provider: string; currentState: unknown; humanChoice?: { selectedCards: string[] }; legalActions?: unknown[] };
    provider = body.provider;
    const { currentState, humanChoice, legalActions } = body;

    if (!provider || !currentState) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: provider, currentState" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const modelName = MODEL_MAP[provider];
    if (!modelName) {
      return new Response(JSON.stringify({ error: "Invalid provider" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
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

    // Ministral struggles with generateObject - use generateText with explicit JSON instructions
    const isMistral = provider.includes("ministral");
    const isGemini = provider.includes("gemini");

    if (isMistral) {
      const jsonPrompt = `${userMessage}\n\nRespond with ONLY a JSON object matching one of these formats (no schema, no explanation):
{ "type": "play_action", "card": "CardName", "reasoning": "..." }
{ "type": "play_treasure", "card": "CardName", "reasoning": "..." }
{ "type": "buy_card", "card": "CardName", "reasoning": "..." }
{ "type": "gain_card", "card": "CardName", "reasoning": "..." }
{ "type": "discard_card", "card": "CardName", "reasoning": "..." }
{ "type": "trash_card", "card": "CardName", "reasoning": "..." }
{ "type": "end_phase", "reasoning": "..." }`;

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
        return new Response(JSON.stringify({ action }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (parseErr) {
        const errorMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
        console.error(`[${provider}] Failed to parse JSON response`);
        console.error(`Full response text:`, result.text);
        console.error(`Extracted JSON string:`, jsonStr);

        return new Response(
          JSON.stringify({
            error: 500,
            message: `Failed to parse model response: ${errorMessage}`,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
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
      ...(isGemini && {
        providerOptions: {
          google: {
            structuredOutputs: false,
          },
        },
      }),
    });

    return new Response(JSON.stringify({ action: result.object }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    // Recovery logic for Ministral
    const errorWithText = err as { text?: string };

    if (errorWithText.text && provider === "ministral-3b") {
      try {
        const text = errorWithText.text;
        const chunks = text.split(/\n\n+/);
        for (let i = chunks.length - 1; i >= 0; i--) {
          const chunk = chunks[i].trim();
          if (chunk.startsWith("{") && chunk.endsWith("}")) {
            try {
              const parsed = JSON.parse(chunk);
              if (parsed.properties || parsed.description && parsed.required) {
                continue;
              }
              if (parsed.type && typeof parsed.type === "string" && parsed.type !== "object") {
                const validated = ActionSchema.parse(parsed);
                console.log(`[${provider}] Recovered from schema echo, extracted valid action`);
                return new Response(JSON.stringify({ action: validated }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" },
                });
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
    console.error(`\n❌ [${provider}] Error generating action`);
    console.error(`Message: ${error.message}`);
    if (error.cause) {
      console.error(`Cause:`, JSON.stringify(error.cause, null, 2));
    }
    if (error.text) {
      console.error(`Raw response text:`, error.text);
    }
    console.error(`Stack:`, error.stack);

    return new Response(
      JSON.stringify({
        error: 500,
        message: `Model failed: ${error.message}`,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Bun runtime configured globally in vercel.json via bunVersion
