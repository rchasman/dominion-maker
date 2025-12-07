import { z } from "zod";
import { CardName } from "./game-state";

export const ActionSchema = z
  .object({
    type: z.enum([
      "play_action",
      "play_treasure",
      "buy_card",
      "end_phase",
      "discard_cards",
      "trash_cards",
      "gain_card",
    ]).describe("The type of action to take"),
    card: CardName.optional().describe("The card to play, buy, or gain (if applicable)"),
    cards: z.array(CardName).optional().describe("The cards to discard or trash (if applicable)"),
    reasoning: z.string().optional().describe("Brief explanation of why this action is chosen"),
  })
  .describe("A single atomic game action");

export type Action = z.infer<typeof ActionSchema>;

/**
 * Strip reasoning field from an action to get its core signature.
 * Useful for comparing actions or creating action signatures.
 */
export function stripReasoning(action: Action): Omit<Action, "reasoning"> {
  const { reasoning: _reasoning, ...actionCore } = action;
  return actionCore;
}
