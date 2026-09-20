import { z } from "zod";
import { cardNameSchema } from "../cards/program";
import type { Action } from "../types/action";

const reasoning = z.string().max(20000).optional();
const action = z.union([
  z
    .object({
      type: z.enum([
        "play_action",
        "play_treasure",
        "buy_card",
        "gain_card",
        "discard_card",
        "trash_card",
        "topdeck_card",
        "skip_decision",
        "end_phase",
        "reveal_reaction",
        "decline_reaction",
      ]),
      card: cardNameSchema.nullish(),
      reasoning,
    })
    .strict(),
  z
    .object({
      type: z.literal("choose_from_options"),
      optionIndex: z.number().int().nonnegative(),
      reasoning,
    })
    .strict(),
]);

/** One Dominion move as it crosses the wire */
export const actionSchema = z.custom<Action>(
  value => action.safeParse(value).success,
  "Invalid action",
);
