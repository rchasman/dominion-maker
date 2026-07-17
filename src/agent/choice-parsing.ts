import type { Action } from "../types/action";
import { hasCardField } from "../lib/action-utils";
import { encodeToon } from "../lib/toon";

/**
 * The numbered-choice reply protocol for the AI turn agent, in one module:
 * formatting the numbered LEGAL ACTIONS list, the reply-format instruction,
 * and parsing the model's {"reasoning": "...", "choice": <n>} reply back
 * into the chosen legal action. Small models are unreliable, so parsing
 * also repairs common quirks: markdown fences, prose around the JSON, and
 * {"answer": "{...}"}-style wrappers.
 */

export type ParsedChoice =
  | { ok: true; action: Action }
  | { ok: false; error: string };

/** Number the legal actions so the model can answer with a single index */
export function formatLegalActions(legalActions: Action[]): string {
  const numbered = legalActions.map((action, index) => ({
    choice: index + 1,
    type: action.type,
    card: hasCardField(action) ? action.card : "",
  }));
  return encodeToon(numbered);
}

/** The one sentence telling the model how to reply — kept next to the parser */
export function replyFormatInstruction(choiceCount: number): string {
  return `Reply with ONLY: {"reasoning": "<1-2 sentences why>", "choice": <1-${choiceCount}>}`;
}

/** Extract JSON from model response that may contain prose and markdown code blocks */
export function extractJson(rawText: string): string | null {
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

/** Resolve a 1-based choice number against the legal actions list */
function resolveRecord(
  record: Record<string, unknown>,
  legalActions: Action[],
): ParsedChoice {
  if (!("choice" in record)) {
    return {
      ok: false,
      error:
        'reply did not contain a "choice" number — do not describe an action, select one by its number',
    };
  }

  const rawChoice = record.choice;
  const choice =
    typeof rawChoice === "number" ? rawChoice : Number(String(rawChoice));

  if (!Number.isInteger(choice)) {
    return {
      ok: false,
      error: `"choice" must be an integer, got ${JSON.stringify(rawChoice)}`,
    };
  }

  const legal = legalActions[choice - 1];
  if (!legal) {
    return {
      ok: false,
      error: `"choice" ${choice} is out of range — LEGAL ACTIONS are numbered 1 to ${legalActions.length}`,
    };
  }

  return {
    ok: true,
    action: { ...legal, reasoning: coerceReasoning(record.reasoning) },
  };
}

/**
 * Parse a model reply into one of the provided legal actions.
 * Handles wrapper quirks: {"answer": "{...}"} (GLM pattern) and
 * single-key wrappers holding stringified JSON.
 */
export function parseModelChoice(
  rawText: string,
  legalActions: Action[],
): ParsedChoice {
  const jsonStr = extractJson(rawText);
  if (!jsonStr) return { ok: false, error: "no JSON object found in reply" };

  try {
    const parsed: unknown = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "reply was not a JSON object" };
    }
    const record = parsed as Record<string, unknown>;

    if (!("choice" in record)) {
      // Unwrap {"answer": "..."} wrapping (GLM pattern)
      if (typeof record.answer === "string") {
        return resolveRecord(JSON.parse(record.answer), legalActions);
      }

      // Unwrap any single-key wrapper with a stringified JSON value
      const values = Object.values(record);
      if (values.length === 1 && typeof values[0] === "string") {
        return resolveRecord(JSON.parse(values[0]), legalActions);
      }
    }

    return resolveRecord(record, legalActions);
  } catch {
    return { ok: false, error: "reply was not valid JSON" };
  }
}
