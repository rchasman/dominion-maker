import { generateObject, generateText, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { GameState, CardName } from "../src/types/game-state";
import { DOMINION_SYSTEM_PROMPT } from "../src/agent/system-prompt";
import { MODEL_MAP, MODELS } from "../src/config/models";
import { buildStrategicContext, formatTurnHistoryForAnalysis } from "../src/agent/strategic-context";
import { CARDS } from "../src/data/cards";
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
        "skip_decision",
        "end_phase",
      ])
      .describe("The type of action to perform"),
    card: CardNameSchema.nullish().describe(
      "The card to act on (not needed for skip_decision or end_phase)",
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

// Create devtools middleware once at module level (singleton pattern)
// Each call to devToolsMiddleware() creates a new run ID, so we create it once
// and reuse it across all requests to maintain shared database state
const sharedDevToolsMiddleware = devToolsMiddleware();

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


// Convert card array to counts for token efficiency
function cardArrayToCounts(cards: string[]): Record<string, number> {
  return cards.reduce(
    (counts, card) => {
      counts[card] = (counts[card] || 0) + 1;
      return counts;
    },
    {} as Record<string, number>,
  );
}

// Transform game state to use counts instead of arrays for AI consumption
// Removes redundant data already present in strategic context or irrelevant to decisions
function optimizeStateForAI(state: GameState): unknown {
  const optimizedPlayers: Record<string, unknown> = {};

  Object.entries(state.players).forEach(([playerId, player]) => {
    const isActivePlayer = playerId === state.activePlayer;

    const optimizedPlayer: Record<string, unknown> = {
      // Only show active player's hand (opponent's hand is hidden information)
      ...(isActivePlayer ? { hand: cardArrayToCounts(player.hand) } : {}),
      deck: player.deck.length, // Always just count (hidden info for both)
      discard: cardArrayToCounts(player.discard), // Public info
      inPlay: cardArrayToCounts(player.inPlay), // Public info
      // Add revealed deck cards when applicable
      ...(player.deckTopRevealed && player.deck.length > 0
        ? { deckTopCards: player.deck }
        : {}),
    };

    optimizedPlayers[playerId] = optimizedPlayer;
  });

  // Calculate effective card costs (base cost - active reductions)
  const costReduction = state.activeEffects
    .filter(e => e.effectType === "cost_reduction")
    .reduce((total, e) => total + ((e.parameters as { amount?: number })?.amount ?? 0), 0);

  // Transform supply with clear cost labeling
  const supplyWithCosts: Record<string, number> = {};
  Object.entries(state.supply).forEach(([card, count]) => {
    const baseCost = CARDS[card as CardName]?.cost ?? 0;
    const effectiveCost = Math.max(0, baseCost - costReduction);
    // Include cost in key for clarity (Estate @ $2: 8)
    const key = costReduction > 0 && baseCost !== effectiveCost
      ? `${card} @ $${effectiveCost} (was $${baseCost})`
      : `${card} @ $${baseCost}`;
    supplyWithCosts[key] = count;
  });

  return {
    // Current phase
    phase: state.phase,

    // YOUR resources (belong to active player)
    you: state.activePlayer,
    yourActions: state.actions,
    yourBuys: state.buys,
    yourCoins: state.coins,

    // Player zones
    players: optimizedPlayers,

    // Board state (with effective costs baked in)
    supply: supplyWithCosts,
    trash: state.trash,

    // Decisions
    ...(state.pendingDecision ? { pendingDecision: state.pendingDecision } : {}),

    // Optional fields
    ...(state.subPhase ? { subPhase: state.subPhase } : {}),

    // Removed (redundant or unclear):
    // - activePlayer (renamed to 'you')
    // - actions/buys/coins (renamed with 'your' prefix for clarity)
    // - activeEffects (cost reductions baked into supply display)
    // - turn, log, turnHistory, decisionQueue, gameOver, winner, playerOrder
    // - kingdomCards, inPlaySourceIndices, opponent's hand
  };
}

// Build user message with context
function buildUserMessage(params: {
  strategicContext: string;
  currentState: GameState;
  recentTurnsStr: string;
  legalActions: unknown[];
  humanChoice?: { selectedCards: string[] };
  format: "json" | "toon";
}): string {
  const {
    strategicContext,
    currentState,
    recentTurnsStr,
    legalActions,
    humanChoice,
    format,
  } = params;

  // Optimize state by converting arrays to counts
  const optimizedState = optimizeStateForAI(currentState);

  // Build structured prompt sections
  const sections: string[] = [strategicContext];

  // Current state
  const stateStr =
    format === "toon"
      ? encodeToon(optimizedState)
      : JSON.stringify(optimizedState, null, JSON_INDENT_SPACES);
  sections.push(`Current state:\n${stateStr}`);

  // Recent turn history (if available)
  if (recentTurnsStr) {
    sections.push(recentTurnsStr);
  }

  // This turn's actions
  if (currentState.turnHistory && currentState.turnHistory.length > 0) {
    const turnHistoryContent =
      format === "toon"
        ? encodeToon(currentState.turnHistory)
        : JSON.stringify(currentState.turnHistory, null, JSON_INDENT_SPACES);
    sections.push(`ACTIONS TAKEN THIS TURN (so far):\n${turnHistoryContent}`);
  }

  // Human choice (if applicable)
  if (humanChoice) {
    const choiceStr =
      format === "toon"
        ? encodeToon(humanChoice.selectedCards)
        : JSON.stringify(humanChoice.selectedCards);
    sections.push(`Human chose: ${choiceStr}`);
  }

  // Legal actions
  const legalActionsContent =
    format === "toon"
      ? encodeToon(legalActions)
      : JSON.stringify(legalActions, null, JSON_INDENT_SPACES);
  sections.push(`LEGAL ACTIONS (you MUST choose one of these):\n${legalActionsContent}`);

  // Question prompt
  const promptQuestion = currentState.pendingDecision
    ? `${currentState.pendingDecision.player.toUpperCase()} must respond to: ${currentState.pendingDecision.prompt}\nWhat action should ${currentState.pendingDecision.player} take?`
    : `What is the next atomic action for ${currentState.activePlayer}?`;
  sections.push(promptQuestion);

  return sections.join("\n\n");
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

// Parse text response with best-effort JSON parser (output is always JSON)
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

// Build output format prompt for text fallback (always JSON output)
function buildTextFallbackPrompt(userMessage: string): string {
  return `${userMessage}\n\nRespond with ONLY a JSON object matching one of these formats (no schema, no explanation):
{ "type": "play_action", "card": "CardName", "reasoning": "..." }
{ "type": "play_treasure", "card": "CardName", "reasoning": "..." }
{ "type": "buy_card", "card": "CardName", "reasoning": "..." }
{ "type": "gain_card", "card": "CardName", "reasoning": "..." }
{ "type": "discard_card", "card": "CardName", "reasoning": "..." }
{ "type": "trash_card", "card": "CardName", "reasoning": "..." }
{ "type": "skip_decision", "reasoning": "..." }
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

  const prompt = buildTextFallbackPrompt(userMessage);

  const result = await generateText({
    model,
    system: DOMINION_SYSTEM_PROMPT,
    prompt,
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
    apiLogger.error(`${provider} extracted data: ${JSON.stringify(parsed)}`);

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
    middleware: sharedDevToolsMiddleware,
  });

  // Format recent turn history (last 3 turns) from log with TOON encoding
  const recentTurnsStr = formatTurnHistoryForAnalysis(currentState, format);

  const strategicContext = buildStrategicContext(
    currentState,
    strategySummary,
    customStrategy,
    format,
  );

  const userMessage = buildUserMessage({
    strategicContext,
    currentState,
    recentTurnsStr,
    legalActions: legalActions || [],
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
