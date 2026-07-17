import type { Action } from "../types/action";

/**
 * Parsing of AI turn-agent replies. The agent is asked to answer with
 * {"reasoning": "...", "choice": <n>} selecting one numbered LEGAL ACTION,
 * but small models are unreliable — this module also repairs common quirks:
 * markdown fences, {"answer": "..."} wrapping, and the legacy
 * {type, card} shape (accepted only when it matches a legal action).
 */

export type ParsedChoice =
  | { ok: true; action: Action }
  | { ok: false; error: string };

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

function actionCard(action: Action): string {
  return "card" in action ? (action.card ?? "") : "";
}

/** Resolve a 1-based choice number against the legal actions list */
function resolveChoice(
  record: Record<string, unknown>,
  legalActions: Action[],
): ParsedChoice {
  const rawChoice = record.choice;
  const choice =
    typeof rawChoice === "number" ? rawChoice : Number(String(rawChoice));

  if (!Number.isInteger(choice)) {
    return {
      ok: false,
      error: `"choice" must be an integer, got ${JSON.stringify(rawChoice)}`,
    };
  }
  if (choice < 1 || choice > legalActions.length) {
    return {
      ok: false,
      error: `"choice" ${choice} is out of range — LEGAL ACTIONS are numbered 1 to ${legalActions.length}`,
    };
  }

  const legal = legalActions[choice - 1];
  if (!legal) {
    return { ok: false, error: `no legal action at choice ${choice}` };
  }
  return {
    ok: true,
    action: { ...legal, reasoning: coerceReasoning(record.reasoning) },
  };
}

/** Legacy repair path: match a {type, card} reply against the legal actions */
function resolveLegacyAction(
  record: Record<string, unknown>,
  legalActions: Action[],
): ParsedChoice {
  const type = record.type;
  const card = typeof record.card === "string" ? record.card : "";

  const match = legalActions.find(
    a => a.type === type && actionCard(a).toLowerCase() === card.toLowerCase(),
  );
  if (!match) {
    return {
      ok: false,
      error: `action {type: ${String(type)}, card: ${card || "none"}} does not match any LEGAL ACTION`,
    };
  }
  return {
    ok: true,
    action: { ...match, reasoning: coerceReasoning(record.reasoning) },
  };
}

function resolveRecord(
  record: Record<string, unknown>,
  legalActions: Action[],
): ParsedChoice {
  if ("choice" in record) return resolveChoice(record, legalActions);
  if ("type" in record) return resolveLegacyAction(record, legalActions);
  return {
    ok: false,
    error: 'reply had neither a "choice" number nor a recognizable action',
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

    if ("choice" in record || "type" in record) {
      return resolveRecord(record, legalActions);
    }

    // Unwrap {"answer": "..."} wrapping (GLM pattern)
    if (typeof record.answer === "string") {
      return resolveRecord(JSON.parse(record.answer), legalActions);
    }

    // Unwrap any single-key wrapper with a stringified JSON value
    const values = Object.values(record);
    if (values.length === 1 && typeof values[0] === "string") {
      return resolveRecord(JSON.parse(values[0]), legalActions);
    }

    return resolveRecord(record, legalActions);
  } catch {
    return { ok: false, error: "reply was not valid JSON" };
  }
}
