import { z } from "zod";
import { CardName } from "./game-state";

// Simplified action schema - no unions
export const ActionSchema = z.object({
  type: z.enum(["play_action", "play_treasure", "buy_card", "gain_card", "discard_card", "trash_card", "end_phase"])
    .describe("The type of action to perform"),
  card: CardName.optional().describe("The card to act on (not needed for end_phase)"),
  reasoning: z.string().optional().describe("Explanation for why this action was chosen"),
}).describe("A single atomic game action");

export type Action = z.infer<typeof ActionSchema>;

/**
 * Strip reasoning field from an action to get its core signature.
 * Useful for comparing actions or creating action signatures.
 */
export function stripReasoning(action: Action): Omit<Action, "reasoning"> {
  const { reasoning: _reasoning, ...actionCore } = action;
  return actionCore;
}
