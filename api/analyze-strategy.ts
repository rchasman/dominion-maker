import { generateObject, gateway } from "ai";
import { z } from "zod";
import type { GameState } from "../src/types/game-state";
import { formatTurnHistoryForAnalysis } from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
import { run } from "../src/lib/run";

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_SERVER_ERROR: 500,
} as const;

// Game constants
const INITIAL_PROVINCE_COUNT = 8;
const INITIAL_DUCHY_COUNT = 8;
const VP_VALUES = {
  ESTATE: 1,
  DUCHY: 3,
  PROVINCE: 6,
  CURSE: -1,
  GARDENS_DIVISOR: 10,
} as const;

const STRATEGY_ANALYSIS_PROMPT = `Data is in TOON format (tab-delimited, 2-space indent, arrays show [length] and {fields}).

Example turn history structure:
\`\`\`toon
turnHistory[3]{player,action,card}:
  human	play_action	Smithy
  human	play_treasure	Gold
  human	buy_card	Province
\`\`\`

You are a Dominion strategy analyst with personality - think Patrick Chapin analyzing a Magic game. Write engaging strategic commentary.

For each player, provide:
1. **Gameplan** (1 line): What they're doing (Big Money/Engine/Hybrid) and current standing
2. **Read** (2-3 sentences): Paragraph analyzing their deck, execution, and position. Be specific about card synergies, buying patterns, and deck quality. Include their main weakness.
3. **Lines** (1-2 sentences): What they should do next and why. Be decisive and actionable.

Write with confidence and personality. Be analytical but engaging. No fluff - every word should matter.`;

const PlayerAnalysisSchema = z.object({
  gameplan: z
    .string()
    .describe("One-line summary of strategy and current standing"),
  read: z
    .string()
    .describe(
      "2-3 sentence paragraph analyzing deck quality, execution, and weakness",
    ),
  lines: z
    .string()
    .describe("1-2 sentences on what to do next and why - be decisive"),
});

const StrategyAnalysisSchema = z.object({
  players: z.record(z.string(), PlayerAnalysisSchema),
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

// Build supply status string
function buildSupplyStatus(supply: Record<string, number>): string {
  const provincesLeft = supply["Province"] ?? INITIAL_PROVINCE_COUNT;
  const duchiesLeft = supply["Duchy"] ?? INITIAL_DUCHY_COUNT;
  const emptyPiles = Object.entries(supply)
    .filter(([, count]) => count === 0)
    .map(([card]) => card)
    .join(", ");
  return `SUPPLY: Provinces ${provincesLeft}/${INITIAL_PROVINCE_COUNT}, Duchies ${duchiesLeft}/${INITIAL_DUCHY_COUNT}${emptyPiles ? `, Empty piles: ${emptyPiles}` : ""}`;
}

// Build player deck information
function buildPlayerDeckInfo(
  playerIds: string[],
  currentState: GameState,
): string {
  return playerIds
    .map(playerId => {
      const player = currentState.players[playerId];
      const allCards = [
        ...player.deck,
        ...player.hand,
        ...player.discard,
        ...player.inPlay,
      ];

      const { counts, vp } = calculatePlayerStats(allCards);

      const summary = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([card, count]) => `${count}x ${card}`)
        .join(", ");

      return `${playerId.toUpperCase()} (${vp} VP, ${allCards.length} cards): ${summary}`;
    })
    .join("\n");
}

// Parse request body safely
async function parseRequestBody(
  req: VercelRequest,
): Promise<{ currentState: GameState }> {
  const rawBody = req.body || (req.text ? await req.text() : "{}");
  const parsed: unknown =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  return parsed as { currentState: GameState };
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
    const { currentState } = await parseRequestBody(req);

    if (!currentState) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ error: "Missing required field: currentState" });
    }

    // Extract turn history
    const turnHistory = formatTurnHistoryForAnalysis(currentState);

    // If no turn history yet, return empty object
    if (!turnHistory) {
      return res.status(HTTP_STATUS.OK).json({ strategySummary: {} });
    }

    // Get all player IDs
    const playerIds = Object.keys(currentState.players);

    // Build comprehensive game state context
    const gameProgress = `GAME STATE: Turn ${currentState.turn}, Phase: ${currentState.phase}`;
    const supplyStatus = buildSupplyStatus(currentState.supply);
    const deckInfo = buildPlayerDeckInfo(playerIds, currentState);

    const prompt = `${gameProgress}\n${supplyStatus}\n\n${turnHistory}\n\nPLAYER DECKS:\n${deckInfo}\n\nProvide a strategic analysis for each player: ${playerIds.join(", ")}.`;

    // Use Claude Opus for high-quality strategy analysis
    const model = gateway("claude-opus-4-5-20251101");

    const result = await generateObject({
      model,
      system: STRATEGY_ANALYSIS_PROMPT,
      prompt,
      schema: StrategyAnalysisSchema,
      maxRetries: 1,
    });

    apiLogger.info("Strategy analysis completed");

    return res.status(HTTP_STATUS.OK).json({
      strategySummary: result.object.players,
    });
  } catch (err) {
    const error = err as Error;

    type ErrorWithDetails = Error & {
      details?: unknown;
      error?: unknown;
      issues?: unknown;
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

    apiLogger.error("Strategy analysis failed:", errorDetails);

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      error: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      message: `Strategy analysis failed: ${error.message}`,
      details: errorDetails,
    });
  }
}
