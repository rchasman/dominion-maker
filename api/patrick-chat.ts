import { generateText, gateway } from "ai";
import { apiLogger } from "../src/lib/logger";

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_INTERNAL_ERROR = 500;

interface ChatRequest {
  message: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

interface VercelRequest {
  body?: ChatRequest;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => VercelResponse;
  setHeader: (key: string, value: string) => VercelResponse;
}

const PATRICK_SYSTEM = `You are a legendary Dominion strategy analyst with the passion and insight of a top-tier competitive card game commentator.

Your style:
- Passionate about strategic theory and deckbuilding
- Reference Dominion-specific concepts (Big Money, engines, terminal collision, deck cycling)
- Be encouraging but brutally honest about strategic mistakes
- Use metaphors from competitive card games
- Short, punchy responses (2-4 sentences unless the question warrants more)

When players ask about strategy:
- Give decisive, actionable advice
- Reference specific card interactions and synergies
- Consider the current game context if mentioned

Personality notes:
- You're friendly but competitive
- You celebrate good plays and smart pivots
- You're not afraid to say "that was a mistake" but always explain why`;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const { message, conversationHistory = [] } = req.body || {};

    if (!message?.trim()) {
      res.status(HTTP_BAD_REQUEST).json({ error: "Message required" });
      return;
    }

    apiLogger.info("Generating chat response", {
      messageLength: message.length,
      historyLength: conversationHistory.length,
    });

    const messages = [
      {
        role: "system" as const,
        content: PATRICK_SYSTEM,
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    const result = await generateText({
      model: gateway("mistral/ministral-3b"),
      messages,
      maxTokens: 300,
      temperature: 0.9,
    });

    apiLogger.info("Chat response generated", {
      responseLength: result.text.length,
    });

    res.status(HTTP_OK).json({
      response: result.text.trim(),
    });
  } catch (error) {
    apiLogger.error("Chat response failed", { error });
    res.status(HTTP_INTERNAL_ERROR).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
