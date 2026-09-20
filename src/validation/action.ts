import { z } from "zod";
import { cardNameSchema } from "../cards/program";
import type { Action } from "../types/action";

const reasoning = z.string().max(20000).optional();
const onCard = { card: cardNameSchema.nullish() };
const shape = {
  play_action: onCard,
  play_treasure: onCard,
  buy_card: onCard,
  gain_card: onCard,
  discard_card: onCard,
  trash_card: onCard,
  topdeck_card: onCard,
  skip_decision: onCard,
  end_phase: onCard,
  reveal_reaction: onCard,
  decline_reaction: onCard,
  choose_from_options: { optionIndex: z.number().int().nonnegative() },
} satisfies Record<Action["type"], z.ZodRawShape>;

const actionSchemas: Record<string, z.ZodType | undefined> = Object.fromEntries(
  Object.entries(shape).map(([type, fields]) => [
    type,
    z.object({ type: z.literal(type), reasoning, ...fields }).strict(),
  ]),
);

/** One Dominion move as it crosses the wire */
export const actionSchema = z.custom<Action>(value => {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    typeof value.type !== "string"
  )
    return false;
  return actionSchemas[value.type]?.safeParse(value).success ?? false;
}, "Invalid action");
