import { actionRequestSchema, readRequest } from "./_request";
import { buildUserMessage } from "../src/agent/action-prompt";
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
import { buildSystemPrompt } from "../src/agent/system-prompt";
import {
  choiceSchema,
  choiceToAction,
  replyFormatInstruction,
} from "../src/agent/choice-parsing";
import { getLegalActions } from "../src/agent/legal-actions";
import { MODELS, type ModelConfig } from "../src/config/models";
import {
  buildStrategicContext,
  formatTurnHistoryForAnalysis,
} from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
import { env } from "../src/lib/env";
import { promptJsonMiddleware } from "../src/agent/model-output";

// HTTP Status Codes
const HTTP_BAD_REQUEST = 400;
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

interface RequestBody {
  provider: string;
  currentState: GameState;
  humanChoice?: { selectedCards: string[] } | undefined;
  strategySummary?: string | undefined;
  customStrategy?: string | undefined;
  actionId?: string | undefined; // For grouping consensus votes in devtools
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

  const config: ModelConfig | undefined = MODELS.find(m => m.id === provider);
  if (!config) {
    return res.status(HTTP_BAD_REQUEST).json({ error: "Invalid provider" });
  }

  const devTools = getDevToolsMiddleware(actionId);
  const middleware = [
    ...(config.structuredOutput === "prompt" ? [promptJsonMiddleware] : []),
    ...(devTools ? [devTools] : []),
  ];
  const baseModel = gateway(config.fullName);
  const model = middleware.length
    ? wrapLanguageModel({ model: baseModel, middleware })
    : baseModel;

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
  // habitual misformatters surface as warns (roster live-verified 2026-09)
  const schema = choiceSchema(legalActions.length);
  const attempt = async (messages: ModelMessage[]) => {
    const { object } = await generateObject({
      model,
      instructions: systemPrompt,
      messages,
      schema,
      maxRetries: 0,
      providerOptions: {
        gateway: {
          ...(config.gatewayProviders
            ? { only: [...config.gatewayProviders] }
            : {}),
          // Actions are short: prioritize time to first token.
          sort: "ttft",
        },
      },
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
  const body = await readRequest(req, res, actionRequestSchema);
  if (!body) return res;

  try {
    return await processGenerationRequest(body, res);
  } catch (err) {
    const provider = body.provider;

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
