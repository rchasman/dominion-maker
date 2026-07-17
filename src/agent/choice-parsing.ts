import { z } from "zod";
import type { Action } from "../types/action";
import { hasCardField } from "../lib/action-utils";
import { encodeToon } from "../lib/toon";
import { run } from "../lib/run";

/**
 * The numbered-choice reply protocol for the AI turn agent, in one module:
 * formatting the numbered LEGAL ACTIONS list, the reply-format instruction,
 * the reply schema, the text-repair hook for generateObject, and the
 * mapping from a validated reply back to the chosen legal action.
 */

/** Number the legal actions so the model can answer with a single index */
export function formatLegalActions(legalActions: Action[]): string {
  const numbered = legalActions.map((action, index) => ({
    choice: index + 1,
    type: action.type,
    card: hasCardField(action) ? action.card : "",
  }));
  return encodeToon(numbered);
}

/** The one sentence telling the model how to reply — kept next to the schema */
export function replyFormatInstruction(choiceCount: number): string {
  return `Reply with ONLY: {"reasoning": "<1-2 sentences why>", "choice": <1-${choiceCount}>}`;
}

/** Reply schema for generateObject — reasoning FIRST so models think before deciding */
export function choiceSchema(choiceCount: number) {
  return z.object({
    reasoning: z.string(),
    choice: z.number().int().min(1).max(choiceCount),
  });
}

export type ChoiceReply = z.infer<ReturnType<typeof choiceSchema>>;

/** Map a schema-validated reply back to the chosen legal action */
export function choiceToAction(
  reply: ChoiceReply,
  legalActions: Action[],
): Action {
  const legal = legalActions[reply.choice - 1];
  if (!legal) {
    throw new Error(
      `choice ${reply.choice} out of range 1-${legalActions.length}`,
    );
  }
  return { ...legal, reasoning: reply.reasoning };
}

/** Extract JSON from model response that may contain prose and markdown code blocks */
function extractJson(rawText: string): string | null {
  // Try raw text as-is first
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{")) return trimmed;

  // Extract from ```json ... ``` or ``` ... ``` code blocks
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  // Last resort: find first { ... } in the text
  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return trimmed.slice(braceStart, braceEnd + 1);
  }

  return null;
}

function coerceReasoning(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

/**
 * Text-repair hook for generateObject (RepairTextFunction-compatible,
 * typed structurally so this module stays free of the "ai" dependency).
 * Repairs the quirks small models produce: markdown fences, prose around
 * the JSON, {"answer": "{...}"}-style wrappers, choice as a numeric
 * string, and missing or non-string reasoning. Returns null when the
 * reply is beyond repair so the SDK surfaces the original error.
 */
export async function repairModelReply(options: {
  text: string;
}): Promise<string | null> {
  const jsonStr = extractJson(options.text);
  if (!jsonStr) return null;

  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    // Unwrap {"answer": "{...}"} and single-key wrappers holding stringified JSON
    const record = run((): Record<string, unknown> | null => {
      const outer = parsed as Record<string, unknown>;
      if ("choice" in outer) return outer;
      const values = Object.values(outer);
      const wrapped = run(() => {
        if (typeof outer.answer === "string") return outer.answer;
        if (values.length === 1 && typeof values[0] === "string") {
          return values[0];
        }
        return null;
      });
      if (wrapped === null) return outer;
      const inner: unknown = JSON.parse(wrapped);
      return inner && typeof inner === "object" && !Array.isArray(inner)
        ? (inner as Record<string, unknown>)
        : null;
    });
    if (!record) return null;

    const coercedChoice =
      typeof record.choice === "string" &&
      Number.isFinite(Number(record.choice))
        ? Number(record.choice)
        : record.choice;

    return JSON.stringify({
      ...record,
      reasoning: coerceReasoning(record.reasoning),
      choice: coercedChoice,
    });
  } catch {
    return null;
  }
}
