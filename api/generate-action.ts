import {
  generateText,
  gateway,
  wrapLanguageModel,
  extractJsonMiddleware,
} from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { VercelRequest, VercelResponse } from "./_http";
import type { GameState, CardName } from "../src/types/game-state";
import type { Action } from "../src/types/action";
import { buildSystemPrompt } from "../src/agent/system-prompt";
import { parseModelChoice } from "../src/agent/choice-parsing";
import { projectPendingChoiceForAI } from "../src/agent/pending-choice-projection";
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
  legalActions?: Action[];
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
    ...(state.pendingChoice
      ? { pendingChoice: projectPendingChoiceForAI(state.pendingChoice) }
      : {}),
    ...(subPhase ? { subPhase } : {}),
  };
}

// Number the legal actions so the model can answer with a single index
function formatLegalActions(legalActions: Action[]): string {
  const numbered = legalActions.map((action, index) => ({
    choice: index + 1,
    type: action.type,
    card: "card" in action ? (action.card ?? "") : "",
  }));
  return encodeToon(numbered);
}

// Build user message with context
function buildUserMessage(params: {
  strategicContext: string;
  currentState: GameState;
  recentTurnsStr: string;
  legalActions: Action[];
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

  const legalActionsSection = [
    `LEGAL ACTIONS — you MUST choose exactly one by number:\n${formatLegalActions(legalActions)}`,
    `Reply with ONLY: {"reasoning": "<1-2 sentences why>", "choice": <1-${legalActions.length}>}`,
  ];

  const sections = [
    `CURRENT STATE:\n${stateStr}`,
    `STRATEGIC CONTEXT:\n${strategicContext}`,
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

  if (!legalActions || legalActions.length === 0) {
    return res
      .status(HTTP_BAD_REQUEST)
      .json({ error: "legalActions must be a non-empty list" });
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
    legalActions,
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

    const parsed = parseModelChoice(result.text, legalActions);
    if (parsed.ok) {
      return res
        .status(HTTP_OK)
        .json({ action: parsed.action, strategySummary });
    }

    // Invalid reply — give the model one corrective retry with the error
    apiLogger.warn(
      `${provider} invalid reply (${parsed.error}), retrying — raw: ${result.text.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
    );

    const retryResult = await generateText({
      model,
      system: systemPrompt,
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: result.text },
        {
          role: "user",
          content: `Your previous reply was invalid: ${parsed.error}. Reply with ONLY the JSON object {"reasoning": "<why>", "choice": <number>} where choice is a number from 1 to ${legalActions.length} selecting one LEGAL ACTION from the list above.`,
        },
      ],
      maxRetries: 0,
    });

    const retryParsed = parseModelChoice(retryResult.text, legalActions);
    if (retryParsed.ok) {
      return res
        .status(HTTP_OK)
        .json({ action: retryParsed.action, strategySummary });
    }

    apiLogger.error(
      `${provider} invalid reply after retry (${retryParsed.error}) — raw: ${retryResult.text.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
    );
    return res.status(HTTP_INTERNAL_ERROR).json({
      error: "Model reply did not select a legal action",
      provider,
      rawText: retryResult.text.slice(0, ERROR_TEXT_PREVIEW_SHORT),
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
