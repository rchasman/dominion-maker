import { z } from "zod";
import type { VercelRequest, VercelResponse } from "./_http";
import { gameStateSchema, cardsSchema } from "../src/validation/game-state";
import { MODEL_MAP } from "../src/config/models";

const text = z.string().trim().min(1).max(20000);
const history = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: text }))
  .max(100)
  .optional();
const strategy = z
  .object({
    gameplan: z.string(),
    read: z.string(),
    recommendation: z.string(),
  })
  .passthrough();
export const actionRequestSchema = z.object({
  provider: z.string().refine(provider => Object.hasOwn(MODEL_MAP, provider)),
  currentState: gameStateSchema,
  humanChoice: z.object({ selectedCards: cardsSchema }).optional(),
  strategySummary: z.string().max(100000).optional(),
  customStrategy: z.string().max(20000).optional(),
  actionId: z.string().max(200).optional(),
});
export const analysisRequestSchema = z.object({
  currentState: gameStateSchema,
  previousAnalysis: z.record(z.string(), strategy).optional(),
});
export const chatRequestSchema = z.object({
  message: text,
  conversationHistory: history,
});
export const reactionRequestSchema = z.object({
  strategy: text,
  conversationHistory: history,
});

export async function readRequest<T>(
  req: VercelRequest,
  res: VercelResponse,
  schema: z.ZodType<T>,
): Promise<T | null> {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return null;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res
      .status(405)
      .json({ error: "Method not allowed", message: "Method not allowed" });
    return null;
  }
  try {
    const raw = req.body ?? (await req.text?.());
    if (typeof raw === "string" && raw.length > 2_000_000) {
      res
        .status(413)
        .json({ error: "Request too large", message: "Request too large" });
      return null;
    }
    const body: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    const result = schema.safeParse(body);
    if (result.success) return result.data;
  } catch {
    /* Malformed JSON is a client error, not a model failure. */
  }
  res
    .status(400)
    .json({ error: "Invalid request", message: "Invalid request" });
  return null;
}
