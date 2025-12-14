import { generateObject, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { GameState, CardName } from "../src/types/game-state";
import { buildSystemPrompt } from "../src/agent/system-prompt";
import { MODEL_MAP, MODELS } from "../src/config/models";
import { buildStrategicContext, formatTurnHistoryForAnalysis } from "../src/agent/strategic-context";
import { CARDS } from "../src/data/cards";
import { apiLogger } from "../src/lib/logger";
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

// Cache devtools middleware instances by actionId for consensus vote grouping
// All votes for same action share one middleware = one devtools thread
const middlewareCache = new Map<
  string,
  { middleware: ReturnType<typeof devToolsMiddleware>; lastUsed: number }
>();

const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup old middleware instances periodically
function cleanupOldMiddleware(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  middlewareCache.forEach((value, key) => {
    if (now - value.lastUsed > CACHE_TTL) {
      toDelete.push(key);
    }
  });

  toDelete.forEach(key => middlewareCache.delete(key));
}

// Run cleanup periodically
setInterval(cleanupOldMiddleware, CACHE_CLEANUP_INTERVAL);

function getDevToolsMiddleware(actionId?: string): ReturnType<typeof devToolsMiddleware> {
  if (!actionId) {
    // No grouping - create fresh middleware
    return devToolsMiddleware();
  }

  // Get or create middleware for this action
  // actionId includes gameId, so different games get different middleware
  if (!middlewareCache.has(actionId)) {
    middlewareCache.set(actionId, {
      middleware: devToolsMiddleware(),
      lastUsed: Date.now(),
    });
  } else {
    // Update last used timestamp
    const cached = middlewareCache.get(actionId)!;
    cached.lastUsed = Date.now();
  }

  return middlewareCache.get(actionId)!.middleware;
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
  actionId?: string; // For grouping consensus votes in devtools
}

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

  // Transform supply to array with counts and effective costs (effects now in system prompt)
  const supplyWithCounts = Object.entries(state.supply).map(([card, count]) => {
    const cardData = CARDS[card as CardName];
    const baseCost = cardData?.cost ?? 0;
    const effectiveCost = Math.max(0, baseCost - costReduction);

    return {
      card,
      count,
      cost: effectiveCost,
    };
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

    // Board state (costs pre-calculated with active effects)
    supply: supplyWithCounts,
    trash: state.trash,

    // Decisions
    ...(state.pendingDecision ? { pendingDecision: state.pendingDecision } : {}),

    // Optional fields
    ...(state.subPhase ? { subPhase: state.subPhase } : {}),

    // Removed (redundant or unclear):
    // - activePlayer (renamed to 'you')
    // - actions/buys/coins (renamed with 'your' prefix for clarity)
    // - activeEffects (only used for cost_reduction, baked into supply costs)
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
    actionId,
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
    middleware: getDevToolsMiddleware(actionId),
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

  // Use generateObject with structured output for all models
  try {
    const result = await generateObject({
      model,
      schema: ActionSchema,
      system: buildSystemPrompt(currentState.supply),
      prompt: userMessage,
      maxRetries: 0,
      ...getProviderOptions(provider),
    });

    return res
      .status(HTTP_OK)
      .json({ action: result.object, strategySummary, format });
  } catch (err) {
    const error = err as Error & { text?: string; response?: unknown };
    apiLogger.error(`${provider} structured output failed: ${error.message}`);

    if (error.text) {
      apiLogger.error(`${provider} raw response text: ${error.text.slice(0, 500)}`);
    }

    return res.status(HTTP_INTERNAL_ERROR).json({
      error: "Structured output generation failed",
      provider,
      message: error.message,
      rawText: error.text?.slice(0, 200),
    });
  }
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
