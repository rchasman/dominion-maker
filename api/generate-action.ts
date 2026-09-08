import { optimizeStateForAI } from "../src/agent/state-projection";
import {
  generateObject,
  gateway,
  wrapLanguageModel,
  NoObjectGeneratedError,
} from "ai";
import type { ModelMessage } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { VercelRequest, VercelResponse } from "./_http";
import type { GameState } from "../src/types/game-state";
import type { Action } from "../src/types/action";
import { buildSystemPrompt } from "../src/agent/system-prompt";
import {
  choiceSchema,
  choiceToAction,
  formatLegalActions,
  replyFormatInstruction,
} from "../src/agent/choice-parsing";
import { getLegalActions } from "../src/agent/legal-actions";
import { MODEL_MAP } from "../src/config/models";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
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
      ? [
          `ACTIONS TAKEN THIS TURN (by ${currentState.activePlayerId}):\n${encodeToon(currentState.turnHistory)}`,
        ]
      : [];

  const humanChoiceSection = humanChoice
    ? [`Human chose: ${encodeToon(humanChoice.selectedCards)}`]
    : [];

  const legalActionsSection = [
    `LEGAL ACTIONS — you MUST choose exactly one by number:\n${formatLegalActions(legalActions)}`,
    replyFormatInstruction(legalActions.length),
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
): Promise<VercelResponse> {
  const {
    provider: bodyProvider,
    currentState,
    humanChoice,
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

  // Derived server-side so the numbering can never disagree with the state
  const legalActions = getLegalActions(currentState);
  if (legalActions.length === 0) {
    return res
      .status(HTTP_BAD_REQUEST)
      .json({ error: "No legal actions for the current state" });
  }

  const modelName = MODEL_MAP[provider];
  if (!modelName) {
    return res.status(HTTP_BAD_REQUEST).json({ error: "Invalid provider" });
  }

  const devTools = getDevToolsMiddleware(actionId);
  const model = devTools
    ? wrapLanguageModel({ model: gateway(modelName), middleware: [devTools] })
    : gateway(modelName);

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

  // No text repair by design — invalid replies get one corrective retry and
  // habitual misformatters surface as warns (roster live-verified 2026-07)
  const schema = choiceSchema(legalActions.length);
  const attempt = async (messages: ModelMessage[]) => {
    const { object } = await generateObject({
      model,
      instructions: systemPrompt,
      messages,
      schema,
      maxRetries: 0,
    });
    return choiceToAction(object, legalActions);
  };

  const generationFailed = (error: Error) => {
    apiLogger.error(`${provider} generation failed: ${error.message}`);
    return res.status(HTTP_INTERNAL_ERROR).json({
      error: "Generation failed",
      provider,
      message: error.message,
    });
  };

  try {
    const action = await attempt([{ role: "user", content: userMessage }]);
    return res.status(HTTP_OK).json({ action, strategySummary });
  } catch (err) {
    if (!NoObjectGeneratedError.isInstance(err)) {
      return generationFailed(err as Error);
    }

    const reason = (
      (err.cause as Error | undefined)?.message ?? err.message
    ).slice(0, ERROR_TEXT_PREVIEW_SHORT);
    apiLogger.warn(
      `${provider} invalid reply (${reason}), retrying — raw: ${err.text?.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
    );

    try {
      const action = await attempt([
        { role: "user", content: userMessage },
        { role: "assistant", content: err.text ?? "" },
        {
          role: "user",
          content: `Your previous reply was invalid: ${reason}. ${replyFormatInstruction(legalActions.length)}`,
        },
      ]);
      return res.status(HTTP_OK).json({ action, strategySummary });
    } catch (retryErr) {
      if (!NoObjectGeneratedError.isInstance(retryErr)) {
        return generationFailed(retryErr as Error);
      }

      apiLogger.error(
        `${provider} invalid reply after retry — raw: ${retryErr.text?.slice(0, ERROR_TEXT_PREVIEW_LONG)}`,
      );
      return res.status(HTTP_INTERNAL_ERROR).json({
        error: "Model reply did not select a legal action",
        provider,
        rawText: retryErr.text?.slice(0, ERROR_TEXT_PREVIEW_SHORT) ?? "",
      });
    }
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
    return await processGenerationRequest(body, res);
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
    const error = err as Error;
    apiLogger.error(`${provider} failed: ${error.message}`);

    return res.status(HTTP_INTERNAL_ERROR).json({
      error: HTTP_INTERNAL_ERROR,
      message: `Model failed: ${error.message}`,
    });
  }
}

// Bun runtime configured globally in vercel.json via bunVersion
