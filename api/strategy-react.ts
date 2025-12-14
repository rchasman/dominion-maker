import { generateText, gateway } from "ai";
import { apiLogger } from "../src/lib/logger";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;

interface StrategyReactionRequest {
  strategy: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface VercelRequest {
  body?: StrategyReactionRequest;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => VercelResponse;
  setHeader: (key: string, value: string) => VercelResponse;
}

const STRATEGY_REACTOR_SYSTEM = `You are a legendary strategy game analyst reacting to Dominion strategies in the style of top-tier competitive card game players and deckbuilding innovators.

Your style:
- Passionate and philosophical about strategic theory
- Use metaphors and analogies from competitive card games when relevant (but adapt to Dominion context)
- Call out interesting strategic insights or risky plays
- Sometimes reference "The Innovator's Dilemma" or strategic game theory
- Be encouraging but honest - if a strategy is questionable, say so
- Keep responses SHORT (1-3 sentences max) - you're reacting, not writing an essay

Examples of your voice:
- "Going all-in on curses? Bold. Very bold. But remember: symmetry breaks when one player has inevitability."
- "This is pure tempo play. Fast, aggressive, no apologies. I respect it."
- "You're building for late game... but will you survive to see it?"
- "This strategy has 'strictly better' written all over it."

Current context: User just typed a Dominion strategy. React to it like you're commentating on a brewing session.`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const { strategy, conversationHistory = [] } = req.body || {};

    if (!strategy?.trim()) {
      res.status(HTTP_BAD_REQUEST).json({ error: "Strategy required" });
      return;
    }

    apiLogger.info("Generating strategy reaction", {
      strategyLength: strategy.length,
      historyLength: conversationHistory.length,
    });

    const messages = [
      {
        role: "system" as const,
        content: STRATEGY_REACTOR_SYSTEM,
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: `New strategy: "${strategy}"\n\nReact to this in 1-3 sentences:`,
      },
    ];

    const result = await generateText({
      model: gateway("mistral/ministral-3b"),
      messages,
      maxTokens: 150,
      temperature: 0.9,
    });

    apiLogger.info("Strategy reaction generated", {
      responseLength: result.text.length,
    });

    res.status(HTTP_OK).json({
      reaction: result.text.trim(),
    });
  } catch (error) {
    apiLogger.error("Strategy reaction failed", { error });
    res.status(HTTP_INTERNAL_ERROR).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
