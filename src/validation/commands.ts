import { z } from "zod";
import { cardNameSchema } from "../cards/program";
import type { GameCommand } from "../commands/types";
import { cardsSchema, decisionChoiceSchema, idSchema } from "./game-state";

const player = { playerId: idSchema };
const card = { ...player, card: cardNameSchema };
const shape = {
  START_GAME: {
    players: z.array(idSchema).min(2).max(4),
    kingdomCards: cardsSchema.optional(),
    seed: z.number().optional(),
  },
  PLAY_ACTION: card,
  PLAY_TREASURE: card,
  PLAY_ALL_TREASURES: player,
  UNPLAY_TREASURE: card,
  BUY_CARD: card,
  END_PHASE: player,
  SUBMIT_DECISION: { ...player, choice: decisionChoiceSchema },
  SKIP_DECISION: player,
  REVEAL_REACTION: card,
  DECLINE_REACTION: player,
  REQUEST_UNDO: {
    ...player,
    toEventId: idSchema,
    reason: z.string().max(2000).optional(),
  },
  APPROVE_UNDO: { ...player, requestId: idSchema },
  DENY_UNDO: { ...player, requestId: idSchema },
} satisfies Record<GameCommand["type"], z.ZodRawShape>;

const commandSchemas: Record<string, z.ZodType | undefined> =
  Object.fromEntries(
    Object.entries(shape).map(([type, fields]) => [
      type,
      z.object({ type: z.literal(type), ...fields }).strict(),
    ]),
  );

/** One player intent as it crosses the wire; the engine still validates it against the state */
export const gameCommandSchema = z.custom<GameCommand>(value => {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    typeof value.type !== "string"
  )
    return false;
  return commandSchemas[value.type]?.safeParse(value).success ?? false;
}, "Invalid command");
