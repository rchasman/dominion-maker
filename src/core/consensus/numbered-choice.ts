import { z } from "zod";
import { encodeToon } from "../../lib/toon";

// The numbered-choice reply protocol, one home. No text repair by design:
// invalid replies go through the endpoint's corrective retry so failures stay visible

/** Number the legal moves so the model can answer with a single index */
export function formatNumberedMoves<M>(
  moves: M[],
  promptRow: (move: M) => Record<string, string | number>,
): string {
  return encodeToon(
    moves.map((move, index) => ({ choice: index + 1, ...promptRow(move) })),
  );
}

/** The reply shape template; every prompt layer that teaches it builds from this */
export function replyShape(choicePlaceholder: string): string {
  return `{"reasoning": "<1-2 sentences why>", "choice": ${choicePlaceholder}}`;
}

/** The one sentence telling the model how to reply, kept next to the schema */
export function replyFormatInstruction(choiceCount: number): string {
  return `Reply with ONLY: ${replyShape(`<1-${choiceCount}>`)}`;
}

/** Reply schema for generateObject: reasoning FIRST so models think before deciding */
export function choiceSchema(choiceCount: number) {
  return z.object({
    reasoning: z.string(),
    choice: z.number().int().min(1).max(choiceCount),
  });
}

type ChoiceReply = z.infer<ReturnType<typeof choiceSchema>>;

/** Map a schema-validated reply back to the chosen legal move */
export function choiceToMove<M>(
  reply: ChoiceReply,
  moves: M[],
  withReasoning: (move: M, reasoning: string) => M,
): M {
  const legal = moves[reply.choice - 1];
  if (legal === undefined) {
    throw new Error(`choice ${reply.choice} out of range 1-${moves.length}`);
  }
  return withReasoning(legal, reply.reasoning);
}
