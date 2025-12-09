import { generateText, createGateway } from "ai";
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

const STRATEGY_ANALYSIS_PROMPT = `You are analyzing a Dominion game. Based on the recent turn history, summarize each player's strategy and tendencies in 2-3 concise sentences per player.

Focus on:
- Buying patterns (Big Money vs Engine Building vs hybrid)
- Card preferences and synergies they're pursuing
- VP timing (when they started greening)
- Any notable tactical patterns

Be specific and actionable. This analysis will help the AI make better decisions.`;

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

    // If no turn history yet, return empty
    if (!turnHistory) {
      return res.status(200).json({ strategySummary: "" });
    }

    // Get all player IDs
    const playerIds = Object.keys(currentState.players);

    // Build prompt with deck composition for context
    const deckInfo = playerIds
      .map(playerId => {
        const player = currentState.players[playerId];
        const allCards = [
          ...player.deck,
          ...player.hand,
          ...player.discard,
          ...player.inPlay,
        ];
        const cardCounts: Record<string, number> = {};
        for (const card of allCards) {
          cardCounts[card] = (cardCounts[card] || 0) + 1;
        }
        const summary = Object.entries(cardCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([card, count]) => `${count}x ${card}`)
          .join(", ");
        return `${playerId} deck (${allCards.length} cards): ${summary}`;
      })
      .join("\n");

    const prompt = `${turnHistory}\n\nCURRENT DECK COMPOSITIONS:\n${deckInfo}\n\nProvide a strategic analysis for each player.`;

    // Use Claude Haiku for fast, cheap strategy analysis
    const model = gateway("claude-3-5-haiku-20241022");

    const result = await generateText({
      model,
      system: STRATEGY_ANALYSIS_PROMPT,
      prompt,
      maxRetries: 1,
      maxTokens: 300,
    });

    apiLogger.info("Strategy analysis completed");

    return res.status(200).json({ strategySummary: result.text });
  } catch (err) {
    const error = err as Error;
    apiLogger.error(`Strategy analysis failed: ${error.message}`);

    return res.status(500).json({
      error: 500,
      message: `Strategy analysis failed: ${error.message}`,
    });
  }
}
