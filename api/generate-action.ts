import { generateObject, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { GameState, CardName } from "../src/types/game-state";
import { buildSystemPrompt } from "../src/agent/system-prompt";
import { MODEL_MAP, MODELS } from "../src/config/models";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "../src/agent/strategic-context";
import { CARDS, isTreasureCard } from "../src/data/cards";
import { countVP } from "../src/lib/board-utils";
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

// Error message display limits
const ERROR_TEXT_PREVIEW_LONG = 500;
const ERROR_TEXT_PREVIEW_SHORT = 200;

// Game stage constants
const DEFAULT_PROVINCE_COUNT = 8;
const EARLY_GAME_TURN_THRESHOLD = 5;
const LATE_GAME_PROVINCES_THRESHOLD = 4;

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

const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MINUTES_TO_MS = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const CACHE_CLEANUP_MINUTES = 5;
const CACHE_TTL_MINUTES = 10;
const CACHE_CLEANUP_INTERVAL = CACHE_CLEANUP_MINUTES * MINUTES_TO_MS;
const CACHE_TTL = CACHE_TTL_MINUTES * MINUTES_TO_MS;

// Cleanup old middleware instances periodically
function cleanupOldMiddleware(): void {
  const now = Date.now();
  const toDelete = Array.from(middlewareCache.entries())
    .filter(([, value]) => now - value.lastUsed > CACHE_TTL)
    .map(([key]) => key);

  toDelete.map(key => middlewareCache.delete(key));
}

// Run cleanup periodically
setInterval(cleanupOldMiddleware, CACHE_CLEANUP_INTERVAL);

function getDevToolsMiddleware(
  actionId?: string,
): ReturnType<typeof devToolsMiddleware> | undefined {
  // Only use devtools in development
  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

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
    const cached = middlewareCache.get(actionId);
    if (cached) {
      cached.lastUsed = Date.now();
    }
  }

  const entry = middlewareCache.get(actionId);
  if (!entry) {
    throw new Error(`Middleware not found for action ${actionId}`);
  }
  return entry.middleware;
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
// Nests all "your" state together for clearer AI reasoning
function optimizeStateForAI(state: GameState): unknown {
  const activePlayerId = state.activePlayer;
  const activePlayer = state.players[activePlayerId];
  const opponentId = Object.keys(state.players).find(
    id => id !== activePlayerId,
  );
  const opponent = opponentId ? state.players[opponentId] : null;

  // Calculate effective card costs (base cost - active reductions)
  const costReduction = state.activeEffects
    .filter(e => e.effectType === "cost_reduction")
    .reduce(
      (total, e) =>
        total + ((e.parameters as { amount?: number })?.amount ?? 0),
      0,
    );

  // Transform supply to array with counts and effective costs
  const supplyWithCounts = Object.entries(state.supply).map(([card, count]) => {
    const cardData = CARDS[card as CardName];
    const baseCost = cardData?.cost ?? 0;
    const effectiveCost = Math.max(0, baseCost - costReduction);
    return { card, count, cost: effectiveCost };
  });

  // Calculate treasures still in hand
  const treasuresInHand = activePlayer
    ? activePlayer.hand.filter(isTreasureCard)
    : [];

  // Calculate current game stage
  const provincesLeft = state.supply["Province"] ?? DEFAULT_PROVINCE_COUNT;
  const currentGameStage = run(() => {
    if (state.turn <= EARLY_GAME_TURN_THRESHOLD) return "Early";
    if (provincesLeft <= LATE_GAME_PROVINCES_THRESHOLD) return "Late";
    return "Mid";
  });

  // Calculate VP and deck composition for both players
  const getAllCards = (player: typeof activePlayer) =>
    player
      ? [...player.deck, ...player.hand, ...player.discard, ...player.inPlay]
      : [];

  const yourAllCards = getAllCards(activePlayer);
  const opponentAllCards = getAllCards(opponent);

  const yourVP = countVP(yourAllCards);
  const opponentVP = countVP(opponentAllCards);

  const yourDeckCounts = yourAllCards.reduce(
    (acc, card) => {
      acc[card] = (acc[card] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const opponentDeckCounts = opponentAllCards.reduce(
    (acc, card) => {
      acc[card] = (acc[card] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Build "you" object with all your state nested together
  const you: Record<string, unknown> = {
    currentPhase: state.phase,
    currentActions: state.actions,
    currentBuys: state.buys,
    currentCoins: state.coins,
    currentVictoryPoints: yourVP,
    currentDeckComposition: yourDeckCounts,
    currentHand: activePlayer ? cardArrayToCounts(activePlayer.hand) : {},
    currentDiscard: activePlayer ? cardArrayToCounts(activePlayer.discard) : {},
    currentInPlay: activePlayer ? cardArrayToCounts(activePlayer.inPlay) : {},
    // Add revealed deck cards when applicable
    ...(activePlayer?.deckTopRevealed && activePlayer.deck.length > 0
      ? { deckTopCards: activePlayer.deck }
      : {}),
    // Buy phase helper: treasures you can still play (always show in buy phase)
    ...(state.phase === "buy"
      ? { currentTreasuresInHand: cardArrayToCounts(treasuresInHand) }
      : {}),
  };

  // Build "opponent" object (no hand - hidden information)
  const opponentState: Record<string, unknown> | null = opponent
    ? {
        currentVictoryPoints: opponentVP,
        currentDeckComposition: opponentDeckCounts,
        currentDiscard: cardArrayToCounts(opponent.discard),
        currentInPlay: cardArrayToCounts(opponent.inPlay),
      }
    : null;

  return {
    currentGameStage,
    you,
    ...(opponentState ? { opponent: opponentState } : {}),
    supply: supplyWithCounts,
    trash: state.trash,
    ...(state.pendingDecision ? { pendingDecision: state.pendingDecision } : {}),
    ...(state.subPhase ? { subPhase: state.subPhase } : {}),
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

  // Build structured prompt sections: state → strategy → history → options → decision
  const stateStr =
    format === "toon"
      ? encodeToon(optimizedState)
      : JSON.stringify(optimizedState, null, JSON_INDENT_SPACES);

  const turnHistorySection =
    currentState.turnHistory && currentState.turnHistory.length > 0
      ? [
          `ACTIONS TAKEN THIS TURN:\n${format === "toon" ? encodeToon(currentState.turnHistory) : JSON.stringify(currentState.turnHistory, null, JSON_INDENT_SPACES)}`,
        ]
      : [];

  const humanChoiceSection = humanChoice
    ? [
        `Human chose: ${format === "toon" ? encodeToon(humanChoice.selectedCards) : JSON.stringify(humanChoice.selectedCards)}`,
      ]
    : [];

  const legalActionsContent =
    format === "toon"
      ? encodeToon(legalActions)
      : JSON.stringify(legalActions, null, JSON_INDENT_SPACES);

  const legalActionsSection =
    legalActions.length > 0
      ? [`LEGAL ACTIONS:\n${legalActionsContent}`]
      : [];

  const sections = [
    `CURRENT STATE:\n${stateStr}`,
    strategicContext,
    ...(recentTurnsStr ? [recentTurnsStr] : []),
    ...turnHistorySection,
    ...humanChoiceSection,
    ...legalActionsSection,
  ];

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

  // Try to recover from text fallback providers - skip for type safety
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

  const middleware = getDevToolsMiddleware(actionId);
  const model = middleware
    ? wrapLanguageModel({
        model: gateway(modelName),
        middleware,
      })
    : gateway(modelName);

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
      apiLogger.error(
        `${provider} raw response text: ${error.text.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
      );
    }

    return res.status(HTTP_INTERNAL_ERROR).json({
      error: "Structured output generation failed",
      provider,
      message: error.message,
      rawText: error.text?.slice(0, ERROR_TEXT_PREVIEW_SHORT),
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
