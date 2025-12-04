import { z } from "zod";
import { CardName } from "./game-state";

export const Action = z.object({
  type: z.enum([
    "play_action",
    "play_treasure",
    "buy_card",
    "end_phase",
    "discard_cards",
    "trash_cards",
    "gain_card",
  ]),
  card: CardName.optional(),
  cards: z.array(CardName).optional(),
  reasoning: z.string().optional(), // Brief explanation of why this action
});

export type Action = z.infer<typeof Action>;
