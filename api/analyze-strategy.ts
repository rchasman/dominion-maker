import { generateObject, createGateway } from "ai";
import { z } from "zod";
import type { GameState } from "../src/types/game-state";
import { formatTurnHistoryForAnalysis } from "../src/agent/strategic-context";
import { apiLogger } from "../src/lib/logger";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

// Create HTTP agents with unlimited concurrent connections
const httpAgent = new HttpAgent({ maxSockets: Infinity, keepAlive: true });
const httpsAgent = new HttpsAgent({ maxSockets: Infinity, keepAlive: true });

// Configure AI Gateway
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY || "",
  fetch: (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const isHttps = url.startsWith("https:");

    return fetch(input, {
      ...init,
      // @ts-expect-error - Node.js agent option
      agent: isHttps ? httpsAgent : httpAgent,
    });
  },
});

const STRATEGY_ANALYSIS_PROMPT = `You are a Dominion strategy analyst with personality - think Patrick Chapin analyzing a Magic game. Write engaging strategic commentary.

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBody = req.body || (req.text ? await req.text() : "{}");
    const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

    const { currentState } = body as {
      currentState: GameState;
    };

    if (!currentState) {
      return res
        .status(400)
        .json({ error: "Missing required field: currentState" });
    }

    // Extract turn history
    const turnHistory = formatTurnHistoryForAnalysis(currentState);

    // If no turn history yet, return empty object
    if (!turnHistory) {
      return res.status(200).json({ strategySummary: {} });
    }

    // Get all player IDs
    const playerIds = Object.keys(currentState.players);

    // Build comprehensive game state context
    const gameContext: string[] = [];

    // Game progress
    gameContext.push(
      `GAME STATE: Turn ${currentState.turn}, Phase: ${currentState.phase}`,
    );

    // Supply status
    const provincesLeft = currentState.supply["Province"] ?? 8;
    const duchiesLeft = currentState.supply["Duchy"] ?? 8;
    const emptyPiles = Object.entries(currentState.supply)
      .filter(([, count]) => count === 0)
      .map(([card]) => card)
      .join(", ");
    gameContext.push(
      `SUPPLY: Provinces ${provincesLeft}/8, Duchies ${duchiesLeft}/8${emptyPiles ? `, Empty piles: ${emptyPiles}` : ""}`,
    );

    // Build detailed player info with VP scores
    const deckInfo = playerIds
      .map(playerId => {
        const player = currentState.players[playerId];
        const allCards = [
          ...player.deck,
          ...player.hand,
          ...player.discard,
          ...player.inPlay,
        ];

        // Calculate VP
        let vp = 0;
        const cardCounts: Record<string, number> = {};
        for (const card of allCards) {
          cardCounts[card] = (cardCounts[card] || 0) + 1;
          if (card === "Estate") vp += 1;
          else if (card === "Duchy") vp += 3;
          else if (card === "Province") vp += 6;
          else if (card === "Curse") vp -= 1;
          else if (card === "Gardens") vp += Math.floor(allCards.length / 10);
        }

        const summary = Object.entries(cardCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([card, count]) => `${count}x ${card}`)
          .join(", ");

        return `${playerId.toUpperCase()} (${vp} VP, ${allCards.length} cards): ${summary}`;
      })
      .join("\n");

    const prompt = `${gameContext.join("\n")}\n\n${turnHistory}\n\nPLAYER DECKS:\n${deckInfo}\n\nProvide a strategic analysis for each player: ${playerIds.join(", ")}.`;

    // Use Claude Haiku for fast, cheap strategy analysis
    const model = gateway("claude-3-5-haiku-20241022");

    const result = await generateObject({
      model,
      system: STRATEGY_ANALYSIS_PROMPT,
      prompt,
      schema: StrategyAnalysisSchema,
      maxRetries: 1,
    });

    apiLogger.info("Strategy analysis completed");

    return res.status(200).json({
      strategySummary: result.object.players,
    });
  } catch (err) {
    const error = err as Error;

    // Extract detailed error information
    const errorDetails = {
      message: error.message,
      cause: error.cause,
      stack: error.stack,
      // @ts-expect-error - Check for additional error properties
      details: error.details || error.error || error.issues,
    };

    apiLogger.error("Strategy analysis failed:", errorDetails);

    return res.status(500).json({
      error: 500,
      message: `Strategy analysis failed: ${error.message}`,
      details: errorDetails,
    });
  }
}
