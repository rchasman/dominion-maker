import { generateObject, generateText, createGateway } from "ai";
import type { GameState } from "../src/types/game-state";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP } from "../src/config/models";
import { buildStrategicContext } from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { parse as parseBestEffort } from "best-effort-json-parser";
import { z } from "zod";

// Zod schemas for runtime validation (server-side only)
const CardNameSchema = z.enum([
  "Copper",
  "Silver",
  "Gold",
  "Estate",
  "Duchy",
  "Province",
  "Curse",
  "Cellar",
  "Chapel",
  "Moat",
  "Harbinger",
  "Merchant",
  "Vassal",
  "Village",
  "Workshop",
  "Bureaucrat",
  "Gardens",
  "Militia",
  "Moneylender",
  "Poacher",
  "Remodel",
  "Smithy",
  "Throne Room",
  "Bandit",
  "Council Room",
  "Festival",
  "Laboratory",
  "Library",
  "Market",
  "Mine",
  "Sentry",
  "Witch",
  "Artisan",
]);

const ActionSchema = z
  .object({
    type: z
      .enum([
        "play_action",
        "play_treasure",
        "buy_card",
        "gain_card",
        "discard_card",
        "trash_card",
        "end_phase",
      ])
      .describe("The type of action to perform"),
    card: CardNameSchema.nullish().describe(
      "The card to act on (not needed for end_phase)",
    ),
    reasoning: z
      .string()
      .optional()
      .describe("Explanation for why this action was chosen"),
  })
  .describe("A single atomic game action");

// Create HTTP agents with unlimited concurrent connections
// Default is 5 connections per host - we increase to Infinity
const httpAgent = new HttpAgent({ maxSockets: Infinity, keepAlive: true });
const httpsAgent = new HttpsAgent({ maxSockets: Infinity, keepAlive: true });

// Configure AI Gateway with custom fetch that uses our unlimited agents
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
  fetch: (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const isHttps = url.startsWith("https:");

    return fetch(input, {
      ...init,
      // @ts-expect-error - Node.js agent option
      agent: isHttps ? httpsAgent : httpAgent,
    });
  },
});

// Debug logging for deployment
if (!process.env.AI_GATEWAY_API_KEY) {
  apiLogger.error("AI_GATEWAY_API_KEY is not set");
} else {
  apiLogger.info("AI_GATEWAY_API_KEY is configured");
}

interface VercelRequest {
  method?: string;
  body?: unknown;
  text?: () => Promise<string>;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => VercelResponse;
  send: (data: string) => VercelResponse;
  setHeader: (key: string, value: string) => VercelResponse;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let provider: string = "";

  try {
    // Vercel with Bun runtime passes body as req.body, not req.json()
    const rawBody = req.body || (req.text ? await req.text() : "{}");
    const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

    const {
      provider: bodyProvider,
      currentState,
      humanChoice,
      legalActions,
    } = body as {
      provider: string;
      currentState: GameState;
      humanChoice?: { selectedCards: string[] };
      legalActions?: unknown[];
    };
    provider = bodyProvider;

    if (!provider || !currentState) {
      return res
        .status(400)
        .json({ error: "Missing required fields: provider, currentState" });
    }

    const modelName = MODEL_MAP[provider];
    if (!modelName) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    const model = gateway(modelName);
    const isAnthropic = provider.startsWith("claude");

    const legalActionsStr =
      legalActions && legalActions.length > 0
        ? `\n\nLEGAL ACTIONS (you MUST choose one of these):\n${JSON.stringify(legalActions, null, 2)}`
        : "";

    const turnHistoryStr =
      currentState.turnHistory && currentState.turnHistory.length > 0
        ? `\n\nACTIONS TAKEN THIS TURN (so far):\n${JSON.stringify(currentState.turnHistory, null, 2)}`
        : "";

    // Strategy summary is passed from client (fetched once per turn)
    const strategySummary = body.strategySummary as string | undefined;

    const strategicContext = buildStrategicContext(
      currentState,
      strategySummary,
    );

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

    // Some models don't support json_schema response format - use generateText with explicit JSON instructions
    const useTextFallback =
      provider.includes("ministral") ||
      provider.includes("cerebras") ||
      provider.includes("groq");

    if (useTextFallback) {
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

      // Extract JSON from text using best-effort parser
      let text = result.text.trim();

      // Strip markdown code blocks first
      const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch) {
        text = codeBlockMatch[1].trim();
      }

      // Configure parser to use our logger for extra token warnings
      const originalOnExtraToken = parseBestEffort.onExtraToken;
      parseBestEffort.onExtraToken = (text, data, reminding) => {
        apiLogger.debug(`${provider} JSON with extra tokens`, {
          extracted: data,
          extraText: reminding.slice(0, 100),
        });
      };

      const parsed = parseBestEffort(text);

      // Restore original handler
      parseBestEffort.onExtraToken = originalOnExtraToken;

      try {
        const action = ActionSchema.parse(parsed);
        return res.status(200).json({ action, strategySummary });
      } catch (parseErr) {
        const errorMessage =
          parseErr instanceof Error ? parseErr.message : String(parseErr);
        apiLogger.error(`${provider} parse failed: ${errorMessage}`);
        apiLogger.error(`${provider} raw text output: ${result.text}`);
        apiLogger.error(
          `${provider} extracted json: ${JSON.stringify(parsed)}`,
        );

        return res.status(500).json({
          error: 500,
          message: `Failed to parse model response: ${errorMessage}`,
        });
      }
    }

    // Use generateObject for other models
    const result = await generateObject({
      model,
      schema: ActionSchema,
      system: DOMINION_SYSTEM_PROMPT,
      prompt: userMessage,
      maxRetries: 0,
    });

    return res.status(200).json({ action: result.object, strategySummary });
  } catch (err) {
    // Recovery logic for Ministral and Gemini
    const errorWithText = err as {
      text?: string;
      value?: { action?: unknown };
    };

    // Handle Gemini wrapping response in extra "action" key
    if (errorWithText.value?.action && provider.includes("gemini")) {
      try {
        const validated = ActionSchema.parse(errorWithText.value.action);
        return res.status(200).json({ action: validated, strategySummary });
      } catch {
        apiLogger.error(`${provider} recovery failed`);
      }
    }

    if (
      errorWithText.text &&
      (provider.includes("ministral") ||
        provider.includes("cerebras") ||
        provider.includes("groq"))
    ) {
      try {
        const text = errorWithText.text;
        const chunks = text.split(/\n\n+/);
        for (let i = chunks.length - 1; i >= 0; i--) {
          const chunk = chunks[i].trim();
          if (chunk.startsWith("{") && chunk.endsWith("}")) {
            try {
              const parsed = JSON.parse(chunk);
              if (
                parsed.properties ||
                (parsed.description && parsed.required)
              ) {
                continue;
              }
              if (
                parsed.type &&
                typeof parsed.type === "string" &&
                parsed.type !== "object"
              ) {
                const validated = ActionSchema.parse(parsed);
                return res
                  .status(200)
                  .json({ action: validated, strategySummary });
              }
            } catch {
              continue;
            }
          }
        }
      } catch {
        apiLogger.error(`${provider} recovery failed`);
      }
    }

    const error = err as Error & { cause?: unknown; text?: string };
    apiLogger.error(`${provider} failed: ${error.message}`);

    return res.status(500).json({
      error: 500,
      message: `Model failed: ${error.message}`,
    });
  }
}

// Bun runtime configured globally in vercel.json via bunVersion
