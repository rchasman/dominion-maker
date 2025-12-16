import { generateObject, gateway, wrapLanguageModel } from "ai";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { z } from "zod";
import type { GameState, CardName } from "../src/types/game-state";
import {
  formatTurnHistoryForAnalysis,
  STRATEGY_ANALYSIS_TURNS,
} from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
import { run } from "../src/lib/run";
import { encodeToon } from "../src/lib/toon";
import { buildCardDefinitionsTable } from "../src/agent/system-prompt";

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Game constants
const VP_VALUES = {
  ESTATE: 1,
  DUCHY: 3,
  PROVINCE: 6,
  CURSE: -1,
  GARDENS_DIVISOR: 10,
} as const;

// Create devtools middleware per request for independent tracking (development only)
function createDevToolsMiddleware() {
  // Only use devtools in development
  if (process.env.NODE_ENV === "production") {
    return;
  }
  return devToolsMiddleware();
}

function buildStrategyAnalysisPrompt(
  supply: Record<CardName, number>,
  hasPreviousAnalysis: boolean,
): string {
  const previousAnalysisGuidance = hasPreviousAnalysis
    ? `
CONTINUITY:
- You provided analysis last turn - reference your previous read if relevant
- Celebrate when players make smart pivots or ignore your advice for something better
- Admit when your recommendation was wrong or didn't account for something
- Track whether strategies are working out as expected`
    : "";

  return `Data is TOON-encoded (self-documenting, tab-delimited).

You are a Dominion strategy analyst with personality - think Patrick Chapin analyzing a Magic game. Write engaging strategic commentary.

CARD DEFINITIONS (static reference):
${buildCardDefinitionsTable(supply)}

For each player, provide:
1. **Gameplan** (1 line): What they're doing (Big Money/Engine/Hybrid) and current standing
2. **Read** (2-3 sentences): Paragraph analyzing their deck, execution, and position. Be specific about card synergies, buying patterns, and deck quality. Include their main weakness.
3. **Recommendation** (1-2 sentences): What they should do next and why. Be decisive and actionable.
${previousAnalysisGuidance}

Write with confidence and personality. Be analytical but engaging. No fluff - every word should matter.`;
}

const PlayerAnalysisSchema = z.object({
  gameplan: z
    .string()
    .describe("One-line summary of strategy and current standing"),
  read: z
    .string()
    .describe(
      "2-3 sentence paragraph analyzing deck quality, execution, and weakness",
    ),
  recommendation: z
    .string()
    .describe("1-2 sentences on what to do next and why - be decisive"),
});

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

interface CardCounts {
  counts: Record<string, number>;
  vp: number;
}

// Calculate VP and card counts using reduce
function calculatePlayerStats(allCards: string[]): CardCounts {
  return allCards.reduce<CardCounts>(
    (acc, card) => {
      const newCounts = { ...acc.counts, [card]: (acc.counts[card] || 0) + 1 };
      const vpDelta = run(() => {
        if (card === "Estate") return VP_VALUES.ESTATE;
        if (card === "Duchy") return VP_VALUES.DUCHY;
        if (card === "Province") return VP_VALUES.PROVINCE;
        if (card === "Curse") return VP_VALUES.CURSE;
        if (card === "Gardens")
          return Math.floor(allCards.length / VP_VALUES.GARDENS_DIVISOR);
        return 0;
      });
      return { counts: newCounts, vp: acc.vp + vpDelta };
    },
    { counts: {}, vp: 0 },
  );
}

// Build player deck information as structured data for TOON encoding
function buildPlayerDeckInfo(
  playerIds: string[],
  currentState: GameState,
): Array<{
  id: string;
  vp: number;
  totalCards: number;
  composition: Record<string, number>;
}> {
  return playerIds.map(playerId => {
    const player = currentState.players[playerId];
    const allCards = [
      ...player.deck,
      ...player.hand,
      ...player.discard,
      ...player.inPlay,
    ];

    const { counts, vp } = calculatePlayerStats(allCards);

    return {
      id: playerId,
      vp,
      totalCards: allCards.length,
      composition: counts,
    };
  });
}

interface PlayerAnalysis {
  gameplan: string;
  read: string;
  recommendation: string;
}

type PlayerAnalysisRecord = Record<string, PlayerAnalysis>;

// Parse request body safely
async function parseRequestBody(
  req: VercelRequest,
): Promise<{
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
      "toon",
      STRATEGY_ANALYSIS_TURNS,
    );

    // If no turn history yet, return empty array
    if (!turnHistory) {
      return res.status(HTTP_STATUS.OK).json({ strategySummary: [] });
    }

    // Get all player IDs
    const playerIds = Object.keys(currentState.players);

    // Build comprehensive game state context using TOON encoding
    const gameContext = {
      turn: currentState.turn,
      phase: currentState.phase,
      supply: currentState.supply,
      trash: currentState.trash,
    };

    const playerDecks = buildPlayerDeckInfo(playerIds, currentState);

    // Use GPT-5.2 for high-quality strategy analysis
    const middleware = createDevToolsMiddleware();
    const model = middleware
      ? wrapLanguageModel({
          model: gateway("gpt-5.2"),
          middleware,
        })
      : gateway("gpt-5.2");

    // Generate analysis one player at a time, build record
    const strategySummary: PlayerAnalysisRecord = {};

    for (const playerId of playerIds) {
      const playerDeck = playerDecks.find(p => p.id === playerId);
      const previousPlayerAnalysis = previousAnalysis?.[playerId];

      const previousAnalysisSection = previousPlayerAnalysis
        ? `\n\nYOUR PREVIOUS ANALYSIS (last turn):\n${encodeToon(previousPlayerAnalysis)}`
        : "";

      const prompt = `${encodeToon(gameContext)}

${turnHistory}

PLAYER DECK (${playerId}):
${encodeToon(playerDeck)}${previousAnalysisSection}

Provide strategic analysis for player: ${playerId}.`;

      const result = await generateObject({
        model,
        system: buildStrategyAnalysisPrompt(
          currentState.supply,
          !!previousPlayerAnalysis,
        ),
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

      strategySummary[playerId] = result.object;
      apiLogger.info(`Strategy analysis completed for ${playerId}`);
    }

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
