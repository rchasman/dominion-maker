import { z } from "zod";
import { CardName } from "./game-state";

// Atomic action that models return - small and focused
export const Action = z.discriminatedUnion("type", [
  // Play a specific action card from hand
  z.object({
    type: z.literal("play_action"),
    card: CardName,
  }),

  // Play a specific treasure card from hand
  z.object({
    type: z.literal("play_treasure"),
    card: CardName,
  }),

  // Buy a specific card from supply
  z.object({
    type: z.literal("buy_card"),
    card: CardName,
  }),

  // End current phase (action or buy)
  z.object({
    type: z.literal("end_phase"),
  }),

  // Discard specific cards (for card effects like Cellar)
  z.object({
    type: z.literal("discard_cards"),
    cards: z.array(CardName),
  }),

  // Trash specific cards (for Chapel, etc.)
  z.object({
    type: z.literal("trash_cards"),
    cards: z.array(CardName),
  }),

  // Gain a specific card (for Workshop, etc.)
  z.object({
    type: z.literal("gain_card"),
    card: CardName,
  }),
]);

export type Action = z.infer<typeof Action>;
