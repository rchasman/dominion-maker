import { generateObject, generateText, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { GameState } from "../src/types/game-state";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP, MODELS } from "../src/config/models";
import { buildStrategicContext } from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
import { parse as parseBestEffort } from "best-effort-json-parser";
import { z } from "zod";
import { encodeToon } from "../src/lib/toon";
import { run } from "../src/lib/run";

// HTTP Status Codes
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_OK = 200;
const HTTP_INTERNAL_ERROR = 500;

// Formatting Constants
const JSON_INDENT_SPACES = 2;
const MAX_EXTRA_TEXT_LENGTH = 100;

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

// Debug logging for deployment
if (!process.env.AI_GATEWAY_API_KEY) {
  apiLogger.error("AI_GATEWAY_API_KEY is not set");
} else {
  apiLogger.info("AI_GATEWAY_API_KEY is configured");
}

// Get provider options for AI Gateway routing
function getProviderOptions(providerId: string) {
  const modelConfig = MODELS.find(m => m.id === providerId);
  if (!modelConfig) return {};

  // Cerebras and Groq need explicit provider routing
  if (modelConfig.provider === "cerebras" || modelConfig.provider === "groq") {
    return {
      providerOptions: {
        gateway: {
          only: [modelConfig.provider],
        },
      },
    };
  }

  return {};
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

interface RequestBody {
  provider: string;
  currentState: GameState;
  humanChoice?: { selectedCards: string[] };
  legalActions?: unknown[];
  strategySummary?: string;
  customStrategy?: string;
  format?: "json" | "toon";
}

type OnExtraTokenHandler = (
  text: string,
  data: unknown,
  reminding: string,
) => void;

// Parse and validate request body
function parseRequestBody(req: VercelRequest): RequestBody {
  const rawBody = req.body || "{}";
  return (
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody
  ) as RequestBody;
}

// Build prompt question based on game state
function buildPromptQuestion(currentState: GameState): string {
  if (currentState.pendingDecision) {
    const decision = currentState.pendingDecision;
    return `${decision.player.toUpperCase()} must respond to: ${decision.prompt}\nWhat action should ${decision.player} take?`;
  }
  return `What is the next atomic action for ${currentState.activePlayer}?`;
}

// Build user message with context
function buildUserMessage(params: {
  strategicContext: string;
  currentState: GameState;
  turnHistoryStr: string;
  legalActionsStr: string;
  promptQuestion: string;
  humanChoice?: { selectedCards: string[] };
  format: "json" | "toon";
}): string {
  const {
    strategicContext,
    currentState,
    turnHistoryStr,
    legalActionsStr,
    promptQuestion,
    humanChoice,
    format,
  } = params;
  const stateStr =
    format === "toon"
      ? encodeToon(currentState)
      : JSON.stringify(currentState, null, JSON_INDENT_SPACES);

  const humanChoiceStr = run(() => {
    if (!humanChoice) return "";
    if (format === "toon") return encodeToon(humanChoice.selectedCards);
    return JSON.stringify(humanChoice.selectedCards);
  });

  return humanChoice
    ? `${strategicContext}\n\nCurrent state:\n${stateStr}${turnHistoryStr}\n\nHuman chose: ${humanChoiceStr}${legalActionsStr}\n\n${promptQuestion}`
    : `${strategicContext}\n\nCurrent state:\n${stateStr}${turnHistoryStr}${legalActionsStr}\n\n${promptQuestion}`;
}

// Check if provider needs text fallback
function needsTextFallback(provider: string): boolean {
  return (
    provider.includes("ministral") ||
    provider.includes("cerebras") ||
    provider.includes("groq")
  );
}

// Extract JSON from markdown code blocks
function stripMarkdownCodeBlocks(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : text;
}

// Parse text response with best-effort JSON parser
function parseTextResponse(text: string, provider: string): unknown {
  const stripped = stripMarkdownCodeBlocks(text.trim());

  const originalOnExtraToken = parseBestEffort.onExtraToken as
    | OnExtraTokenHandler
    | undefined;
  parseBestEffort.onExtraToken = (
    text: string,
    data: unknown,
    reminding: string,
  ) => {
    apiLogger.debug(`${provider} JSON with extra tokens`, {
      extracted: data,
      extraText: reminding.slice(0, MAX_EXTRA_TEXT_LENGTH),
    });
  };

  const parsed = parseBestEffort(stripped) as unknown;
  if (originalOnExtraToken) {
    parseBestEffort.onExtraToken = originalOnExtraToken;
  }

  return parsed;
}

// Try to recover action from error response text
function tryRecoverActionFromText(
  text: string,
): z.infer<typeof ActionSchema> | undefined {
  const chunks = text.split(/\n\n+/);

  const validAction = chunks
    .slice()
    .reverse()
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.startsWith("{") && chunk.endsWith("}"))
    .reduce<{ validated?: z.infer<typeof ActionSchema> }>((result, chunk) => {
      if (result.validated) return result;

      try {
        const parsed: unknown = JSON.parse(chunk);

        // Type guard: check if this is a record-like object
        if (typeof parsed !== "object" || parsed === null) {
          return result;
        }

        const record = parsed as Record<string, unknown>;

        // Skip schema objects
        if (record.properties || (record.description && record.required)) {
          return result;
        }

        // Check if this is an action object
        if (
          record.type &&
          typeof record.type === "string" &&
          record.type !== "object"
        ) {
          const validated = ActionSchema.parse(parsed);
          return { validated };
        }
      } catch {
        // Continue to next chunk
      }

      return result;
    }, {});

  return validAction.validated;
}

// Build JSON prompt for text fallback
function buildTextFallbackJsonPrompt(userMessage: string): string {
  return `${userMessage}\n\nRespond with ONLY a JSON object matching one of these formats (no schema, no explanation):
{ "type": "play_action", "card": "CardName", "reasoning": "..." }
{ "type": "play_treasure", "card": "CardName", "reasoning": "..." }
{ "type": "buy_card", "card": "CardName", "reasoning": "..." }
{ "type": "gain_card", "card": "CardName", "reasoning": "..." }
{ "type": "discard_card", "card": "CardName", "reasoning": "..." }
{ "type": "trash_card", "card": "CardName", "reasoning": "..." }
{ "type": "end_phase", "reasoning": "..." }`;
}

// Generate action using text fallback (for models without JSON schema support)
async function generateActionWithTextFallback(params: {
  model: ReturnType<typeof gateway>;
  userMessage: string;
  provider: string;
  res: VercelResponse;
  strategySummary: string | undefined;
  format: "json" | "toon";
}): Promise<VercelResponse> {
  const { model, userMessage, provider, res, strategySummary, format } = params;

  const jsonPrompt = buildTextFallbackJsonPrompt(userMessage);

  const result = await generateText({
    model,
    system: DOMINION_SYSTEM_PROMPT,
    prompt: jsonPrompt,
    maxRetries: 0,
    ...getProviderOptions(provider),
  });

  const parsed = parseTextResponse(result.text, provider);

  try {
    const action = ActionSchema.parse(parsed);
    return res.status(HTTP_OK).json({ action, strategySummary, format });
  } catch (parseErr) {
    const errorMessage =
      parseErr instanceof Error ? parseErr.message : String(parseErr);
    apiLogger.error(`${provider} parse failed: ${errorMessage}`);
    apiLogger.error(`${provider} raw text output: ${result.text}`);
    apiLogger.error(`${provider} extracted json: ${JSON.stringify(parsed)}`);

    return res.status(HTTP_INTERNAL_ERROR).json({
      error: HTTP_INTERNAL_ERROR,
      message: `Failed to parse model response: ${errorMessage}`,
    });
  }
}

// Try to recover from model generation errors
function tryRecoverFromError(
  err: unknown,
  provider: string,
  res: VercelResponse,
): VercelResponse | undefined {
  const strategySummary = undefined as string | undefined;

  // Type guard: check if error is an object
  if (typeof err !== "object" || err === null) {
    return undefined;
  }

  const errorRecord = err as Record<string, unknown>;

  // Handle Gemini wrapping response in extra "action" key
  if (
    errorRecord.value &&
    typeof errorRecord.value === "object" &&
    errorRecord.value !== null
  ) {
    const valueRecord = errorRecord.value as Record<string, unknown>;
    if (valueRecord.action && provider.includes("gemini")) {
      try {
        const validated = ActionSchema.parse(valueRecord.action);
        return res.status(HTTP_OK).json({ action: validated, strategySummary });
      } catch {
        apiLogger.error(`${provider} recovery failed`);
      }
    }
  }

  // Try to recover from text fallback providers
  if (
    errorRecord.text &&
    typeof errorRecord.text === "string" &&
    needsTextFallback(provider)
  ) {
    try {
      const validated = tryRecoverActionFromText(errorRecord.text);
      if (validated) {
        return res.status(HTTP_OK).json({ action: validated, strategySummary });
      }
    } catch {
      apiLogger.error(`${provider} recovery failed`);
    }
  }

  return undefined;
}

// Process request body and validate input
async function processGenerationRequest(
  body: RequestBody,
  res: VercelResponse,
): Promise<VercelResponse | null> {
  const {
    provider: bodyProvider,
    currentState,
    humanChoice,
    legalActions,
    strategySummary,
    customStrategy,
    format = "toon",
  } = body;
  const provider = bodyProvider;

  if (!provider || !currentState) {
    return res
      .status(HTTP_BAD_REQUEST)
      .json({ error: "Missing required fields: provider, currentState" });
  }

  const modelName = MODEL_MAP[provider];
  if (!modelName) {
    return res.status(HTTP_BAD_REQUEST).json({ error: "Invalid provider" });
  }

  const model = wrapLanguageModel({
    model: gateway(modelName),
    middleware: devToolsMiddleware,
  });

  const legalActionsStr = run(() => {
    if (!legalActions || legalActions.length === 0) return "";
    const content =
      format === "toon"
        ? encodeToon(legalActions)
        : JSON.stringify(legalActions, null, JSON_INDENT_SPACES);
    return `\n\nLEGAL ACTIONS (you MUST choose one of these):\n${content}`;
  });

  const turnHistoryStr = run(() => {
    if (!currentState.turnHistory || currentState.turnHistory.length === 0)
      return "";
    const content =
      format === "toon"
        ? encodeToon(currentState.turnHistory)
        : JSON.stringify(currentState.turnHistory, null, JSON_INDENT_SPACES);
    return `\n\nACTIONS TAKEN THIS TURN (so far):\n${content}`;
  });

  const strategicContext = buildStrategicContext(
    currentState,
    strategySummary,
    customStrategy,
  );
  const promptQuestion = buildPromptQuestion(currentState);
  const userMessage = buildUserMessage({
    strategicContext,
    currentState,
    turnHistoryStr,
    legalActionsStr,
    promptQuestion,
    humanChoice,
    format,
  });

  // Some models don't support json_schema response format - use generateText with explicit JSON instructions
  if (needsTextFallback(provider)) {
    return await generateActionWithTextFallback({
      model,
      userMessage,
      provider,
      res,
      strategySummary,
      format,
    });
  }

  // Use generateObject for other models
  const result = await generateObject({
    model,
    schema: ActionSchema,
    system: DOMINION_SYSTEM_PROMPT,
    prompt: userMessage,
    maxRetries: 0,
    ...getProviderOptions(provider),
  });

  return res
    .status(HTTP_OK)
    .json({ action: result.object, strategySummary, format });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(HTTP_NO_CONTENT).send("");
  }

  if (req.method !== "POST") {
    return res
      .status(HTTP_METHOD_NOT_ALLOWED)
      .json({ error: "Method not allowed" });
  }

  try {
    const body = parseRequestBody(req);
    const result = await processGenerationRequest(body, res);
    if (result) return result;

    // If no result returned, this shouldn't happen - return error
    return res.status(HTTP_INTERNAL_ERROR).json({
      error: HTTP_INTERNAL_ERROR,
      message: "Internal error: no response generated",
    });
  } catch (err) {
    // Try to parse body for provider name in error logging
    const provider = run(() => {
      try {
        return parseRequestBody(req).provider;
      } catch {
        return "unknown";
      }
    });

    // Try recovery strategies
    const recovered = tryRecoverFromError(err, provider, res);
    if (recovered) return recovered;

    // Log and return error
    const error = err as Error & { cause?: unknown; text?: string };
    apiLogger.error(`${provider} failed: ${error.message}`);

    return res.status(HTTP_INTERNAL_ERROR).json({
      error: HTTP_INTERNAL_ERROR,
      message: `Model failed: ${error.message}`,
    });
  }
}

// Bun runtime configured globally in vercel.json via bunVersion
