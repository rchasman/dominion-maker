import { z } from "zod";
import type { Action } from "../types/action";
import { hasCardField } from "../lib/action-utils";
import { encodeToon } from "../lib/toon";

// The numbered-choice reply protocol, one home. No text repair by design —
// invalid replies go through the endpoint's corrective retry so failures stay visible

/** Number the legal actions so the model can answer with a single index */
export function formatLegalActions(legalActions: Action[]): string {
  const numbered = legalActions.map((action, index) => ({
    choice: index + 1,
    type: action.type,
    card: hasCardField(action) ? action.card : "",
  }));
  return encodeToon(numbered);
}

/** The reply shape template — every prompt layer that teaches it builds from this */
export function replyShape(choicePlaceholder: string): string {
  return `{"reasoning": "<1-2 sentences why>", "choice": ${choicePlaceholder}}`;
}

/** The one sentence telling the model how to reply — kept next to the schema */
export function replyFormatInstruction(choiceCount: number): string {
  return `Reply with ONLY: ${replyShape(`<1-${choiceCount}>`)}`;
}

/** Reply schema for generateObject — reasoning FIRST so models think before deciding */
export function choiceSchema(choiceCount: number) {
  return z.object({
    reasoning: z.string(),
    choice: z.number().int().min(1).max(choiceCount),
  });
}

type ChoiceReply = z.infer<ReturnType<typeof choiceSchema>>;

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
