import {
  generateText,
  gateway,
  wrapLanguageModel,
  extractJsonMiddleware,
} from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { VercelRequest, VercelResponse } from "./_http";
import type { GameState, CardName } from "../src/types/game-state";
import { buildSystemPrompt } from "../src/agent/system-prompt";
import { MODEL_MAP } from "../src/config/models";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "../src/agent/strategic-context";
import { CARDS, isTreasureCard } from "../src/data/cards";
import { countCards } from "../src/lib/card-array-utils";
import { countVP, getAllCards } from "../src/lib/board-utils";
import { apiLogger } from "../src/lib/logger";
import { getSubPhase } from "../src/lib/state-helpers";
import { z } from "zod";
import { encodeToon } from "../src/lib/toon";
import { run } from "../src/lib/run";
import { env } from "../src/lib/env";

// HTTP Status Codes
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_METHOD_NOT_ALLOWED = 405;
const HTTP_OK = 200;
const HTTP_INTERNAL_ERROR = 500;

// Error message display limits
const ERROR_TEXT_PREVIEW_LONG = 500;
const ERROR_TEXT_PREVIEW_SHORT = 200;

// Game stage constants
const DEFAULT_PROVINCE_COUNT = 8;
const EARLY_GAME_TURN_THRESHOLD = 5;
const LATE_GAME_PROVINCES_THRESHOLD = 4;

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
        "topdeck_card",
        "skip_decision",
        "end_phase",
        "reveal_reaction",
        "decline_reaction",
      ])
      .describe("The type of action to perform"),
    card: z
      .string()
      .describe(
        "The card name to act on, or empty string for skip_decision/end_phase",
      ),
    reasoning: z
      .string()
      .describe("Explanation for why this action was chosen"),
  })
  .describe("A single atomic game action");

// Repair malformed structured output from models that don't follow the schema
// Handles: {"answer": "{...}"} wrapping (GLM-5), direct JSON without schema compliance
type ActionOutput = z.infer<typeof ActionSchema>;
function tryParseRecord(record: Record<string, unknown>): ActionOutput | null {
  // Add defaults for fields models often omit
  if (!("reasoning" in record)) record.reasoning = "";
  // Coerce reasoning to string — some models return it as a nested object
  if (typeof record.reasoning === "object" && record.reasoning !== null) {
    record.reasoning = JSON.stringify(record.reasoning);
  }
  if (!("card" in record) || record.card === null) record.card = "";
  const result = ActionSchema.safeParse(record);
  return result.success ? result.data : null;
}

// Extract JSON from model response that may contain prose and markdown code blocks
function extractJson(rawText: string): string | null {
  // Try raw text as-is first
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{")) return trimmed;

  // Extract from ```json ... ``` or ``` ... ``` code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  // Last resort: find first { ... } in the text
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return trimmed.slice(braceStart, braceEnd + 1);
  }

  return null;
}

// Parse action from raw text, handling model quirks like wrapping or missing fields
function parseActionFromText(rawText: string): ActionOutput | null {
  const jsonStr = extractJson(rawText);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object") return null;

    // Direct match
    if ("type" in parsed) return tryParseRecord(parsed);

    // Unwrap {"answer": "..."} wrapping (GLM-5 pattern)
    if (typeof parsed.answer === "string") {
      return tryParseRecord(JSON.parse(parsed.answer));
    }

    // Unwrap any single-key wrapper with a stringified JSON value
    const values = Object.values(parsed);
    if (values.length === 1 && typeof values[0] === "string") {
      return tryParseRecord(JSON.parse(values[0] as string));
    }

    return null;
  } catch {
    return null;
  }
}

// Debug logging for deployment
if (!env.AI_GATEWAY_API_KEY) {
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
  if (env.NODE_ENV === "production") {
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

interface RequestBody {
  provider: string;
  currentState: GameState;
  humanChoice?: { selectedCards: string[] };
  legalActions?: unknown[];
  strategySummary?: string;
  customStrategy?: string;
  actionId?: string; // For grouping consensus votes in devtools
}

// Parse and validate request body
function parseRequestBody(req: VercelRequest): RequestBody {
  const rawBody = req.body || "{}";
  return (
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody
  ) as RequestBody;
}

// Transform game state to use counts instead of arrays for AI consumption
// Nests all "your" state together for clearer AI reasoning
function optimizeStateForAI(state: GameState): unknown {
  const activePlayerId = state.activePlayerId;
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
  const yourAllCards = activePlayer ? getAllCards(activePlayer) : [];
  const opponentAllCards = opponent ? getAllCards(opponent) : [];

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
    currentHand: activePlayer ? countCards(activePlayer.hand) : {},
    currentDiscard: activePlayer ? countCards(activePlayer.discard) : {},
    currentInPlay: activePlayer ? countCards(activePlayer.inPlay) : {},
    // Add revealed deck cards when applicable
    ...(activePlayer?.deckTopRevealed && activePlayer.deck.length > 0
      ? { deckTopCards: activePlayer.deck }
      : {}),
    // Buy phase helper: treasures you can still play (always show in buy phase)
    ...(state.phase === "buy"
      ? { currentTreasuresInHand: countCards(treasuresInHand) }
      : {}),
  };

  // Build "opponent" object (no hand - hidden information)
  const opponentState: Record<string, unknown> | null = opponent
    ? {
        currentVictoryPoints: opponentVP,
        currentDeckComposition: opponentDeckCounts,
        currentDiscard: countCards(opponent.discard),
        currentInPlay: countCards(opponent.inPlay),
      }
    : null;

  const subPhase = getSubPhase(state);

  return {
    currentGameStage,
    you,
    ...(opponentState ? { opponent: opponentState } : {}),
    supply: supplyWithCounts,
    trash: state.trash,
    ...(state.pendingChoice ? { pendingChoice: state.pendingChoice } : {}),
    ...(subPhase ? { subPhase } : {}),
  };
}

// Build user message with context
function buildUserMessage(params: {
  strategicContext: string;
  currentState: GameState;
  recentTurnsStr: string;
  legalActions: unknown[];
  humanChoice?: { selectedCards: string[] };
}): string {
  const {
    strategicContext,
    currentState,
    recentTurnsStr,
    legalActions,
    humanChoice,
  } = params;

  // Optimize state by converting arrays to counts
  const optimizedState = optimizeStateForAI(currentState);

  // Build structured prompt sections: state → strategy → history → options → decision
  const stateStr = encodeToon(optimizedState);

  const turnHistorySection =
    currentState.turnHistory && currentState.turnHistory.length > 0
      ? [`ACTIONS TAKEN THIS TURN:\n${encodeToon(currentState.turnHistory)}`]
      : [];

  const humanChoiceSection = humanChoice
    ? [`Human chose: ${encodeToon(humanChoice.selectedCards)}`]
    : [];

  const legalActionsContent = encodeToon(legalActions);

  const legalActionsSection =
    legalActions.length > 0 ? [`LEGAL ACTIONS:\n${legalActionsContent}`] : [];

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

  const devTools = getDevToolsMiddleware(actionId);
  // extractJsonMiddleware strips markdown code fences (```json...```) from model responses
  const model = wrapLanguageModel({
    model: gateway(modelName),
    middleware: [extractJsonMiddleware(), ...(devTools ? [devTools] : [])],
  });

  // Format recent turn history (last 3 turns) from log with TOON encoding
  const recentTurnsStr = formatTurnHistoryForAnalysis(currentState);

  const strategicContext = buildStrategicContext(
    currentState,
    strategySummary,
    customStrategy,
  );

  const userMessage = buildUserMessage({
    strategicContext,
    currentState,
    recentTurnsStr,
    legalActions: legalActions || [],
    ...(humanChoice ? { humanChoice } : {}),
  });

  const systemPrompt = buildSystemPrompt(currentState.supply);

  // Universal path: generateText + JSON parse works with every model
  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userMessage,
      maxRetries: 0,
    });

    const jsonStr = extractJson(result.text);
    if (!jsonStr) {
      apiLogger.error(
        `${provider} no JSON found in response (${result.text.length} chars): ${result.text.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
      );
      return res.status(HTTP_INTERNAL_ERROR).json({
        error: "No JSON in response",
        provider,
        rawText: result.text.slice(0, ERROR_TEXT_PREVIEW_SHORT),
      });
    }

    const parsed = parseActionFromText(result.text);
    if (parsed) {
      return res.status(HTTP_OK).json({ action: parsed, strategySummary });
    }

    // JSON was found but didn't match schema — log both raw and extracted
    apiLogger.error(
      `${provider} JSON schema mismatch — extracted: ${jsonStr.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
    );
    return res.status(HTTP_INTERNAL_ERROR).json({
      error: "JSON parse failed",
      provider,
      rawText: result.text.slice(0, ERROR_TEXT_PREVIEW_SHORT),
    });
  } catch (err) {
    const error = err as Error;
    apiLogger.error(`${provider} generation failed: ${error.message}`);
    return res.status(HTTP_INTERNAL_ERROR).json({
      error: "Generation failed",
      provider,
      message: error.message,
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
