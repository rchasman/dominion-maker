import { z } from "zod";
import { CardName } from "./game-state";

// Discriminated union: card vs cards based on action type
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("play_action"),
    card: CardName.describe("The action card to play"),
    reasoning: z.string().optional(),
  }),
  z.object({
    type: z.literal("play_treasure"),
    card: CardName.describe("The treasure card to play"),
    reasoning: z.string().optional(),
  }),
  z.object({
    type: z.literal("buy_card"),
    card: CardName.describe("The card to buy from supply"),
    reasoning: z.string().optional(),
  }),
  z.object({
    type: z.literal("gain_card"),
    card: CardName.describe("The card to gain"),
    reasoning: z.string().optional(),
  }),
  z.object({
    type: z.literal("discard_cards"),
    cards: z.array(CardName).describe("Array of cards to discard"),
    reasoning: z.string().optional(),
  }),
  z.object({
    type: z.literal("trash_cards"),
    cards: z.array(CardName).describe("Array of cards to trash"),
    reasoning: z.string().optional(),
  }),
  z.object({
    type: z.literal("end_phase"),
    reasoning: z.string().optional(),
  }),
]).describe("A single atomic game action");

export type Action = z.infer<typeof ActionSchema>;

/**
 * Strip reasoning field from an action to get its core signature.
 * Useful for comparing actions or creating action signatures.
 */
export function stripReasoning(action: Action): Omit<Action, "reasoning"> {
  const { reasoning: _reasoning, ...actionCore } = action;
  return actionCore;
}
