import { z } from "zod";
import type { Action } from "../types/action";
import { hasCardField } from "../lib/action-utils";
import { encodeToon } from "../lib/toon";

/**
 * The numbered-choice reply protocol for the AI turn agent, in one module:
 * formatting the numbered LEGAL ACTIONS list, the reply-format instruction,
 * the reply schema for generateObject, and the mapping from a validated
 * reply back to the chosen legal action. Malformed replies are not
 * repaired — the endpoint's corrective retry handles them, which keeps
 * every failure visible in the logs.
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
