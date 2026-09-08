import { generateObject, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { VercelRequest, VercelResponse } from "./_http";
import type { GameState } from "../src/types/game-state";
import {
  formatTurnHistoryForAnalysis,
  STRATEGY_ANALYSIS_TURNS,
} from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
import { env } from "../src/lib/env";
import {
  buildStrategyAnalysisPrompt,
  buildStrategyAnalysisMessage,
  PlayerAnalysisSchema,
  type PlayerAnalysisRecord,
} from "../src/agent/strategy-analysis";

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Create devtools middleware per request for independent tracking (development only)
function createDevToolsMiddleware() {
  // Only use devtools in development
  if (env.NODE_ENV === "production") {
    return;
  }
  return devToolsMiddleware();
}

// Parse request body safely
async function parseRequestBody(req: VercelRequest): Promise<{
  currentState: GameState;
  previousAnalysis?: PlayerAnalysisRecord;
}> {
  const rawBody = req.body || (req.text ? await req.text() : "{}");
  const parsed: unknown =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  return parsed as {
    currentState: GameState;
    previousAnalysis?: PlayerAnalysisRecord;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(HTTP_STATUS.NO_CONTENT).send("");
  }

  if (req.method !== "POST") {
    return res
      .status(HTTP_STATUS.METHOD_NOT_ALLOWED)
      .json({ error: "Method not allowed" });
  }

  try {
    const { currentState, previousAnalysis } = await parseRequestBody(req);

    if (!currentState) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "Missing required field: currentState" });
    }

    // Extract turn history (use longer window for strategy - runs once per turn)
    const turnHistory = formatTurnHistoryForAnalysis(
      currentState,
      STRATEGY_ANALYSIS_TURNS,
    );

    // If no turn history yet, return empty array
    if (!turnHistory) {
      return res.status(HTTP_STATUS.OK).json({ strategySummary: [] });
    }

    // Get all player IDs
    const playerIds = Object.keys(currentState.players);

    // Use GPT-5.4 for high-quality strategy analysis
    const middleware = createDevToolsMiddleware();
    const model = middleware
      ? wrapLanguageModel({
          model: gateway("openai/gpt-5.4"),
          middleware,
        })
      : gateway("openai/gpt-5.4");

    // Generate analysis one player at a time, build record
    const strategySummary: PlayerAnalysisRecord = Object.fromEntries(
      await Promise.all(
        playerIds.map(async playerId => {
          const prompt = buildStrategyAnalysisMessage(
            currentState,
            playerId,
            previousAnalysis?.[playerId],
          );

          const result = await generateObject({
            model,
            instructions: buildStrategyAnalysisPrompt(currentState.supply),
            prompt,
            schema: PlayerAnalysisSchema,
            maxRetries: 1,
            providerOptions: {
              anthropic: {
                headers: {
                  "anthropic-beta": "structured-outputs-2025-11-13",
                },
              },
            },
          });

          apiLogger.info(`Strategy analysis completed for ${playerId}`);
          return [playerId, result.object] as const;
        }),
      ),
    );

    return res.status(HTTP_STATUS.OK).json({
      strategySummary,
    });
  } catch (err) {
    const error = err as Error;

    type ErrorWithDetails = Error & {
      details?: unknown;
      error?: unknown;
      issues?: unknown;
      text?: string;
    };

    const errorWithDetails = error as ErrorWithDetails;

    // Extract detailed error information
    const errorDetails = {
      message: error.message,
      cause: "cause" in error ? error.cause : undefined,
      stack: error.stack,
      details:
        errorWithDetails.details ||
        errorWithDetails.error ||
        errorWithDetails.issues,
    };

    // Log raw text if parsing failed
    if (errorWithDetails.text) {
      apiLogger.error("Raw AI response:", errorWithDetails.text);
    }

    apiLogger.error("Strategy analysis failed:", errorDetails);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: `Strategy analysis failed: ${error.message}`,
      details: errorDetails,
    });
  }
}
