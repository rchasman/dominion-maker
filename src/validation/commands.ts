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

/**
 * The only commands a seated player may send into a room. Setup stays off the
 * wire, and the rest are reachable through the engine alone. `shape` above is
 * exhaustive over `GameCommand`, so this allowlist reads against the full set.
 */
const roomCommandTypes = [
  "PLAY_ACTION",
  "PLAY_TREASURE",
  "PLAY_ALL_TREASURES",
  "BUY_CARD",
  "END_PHASE",
  "SUBMIT_DECISION",
  "REQUEST_UNDO",
  "APPROVE_UNDO",
  "DENY_UNDO",
] as const satisfies readonly GameCommand["type"][];

const roomCommandSchemas: Record<string, z.ZodType | undefined> =
  Object.fromEntries(
    roomCommandTypes.map(type => [
      type,
      z.object({ type: z.literal(type), ...shape[type] }).strict(),
    ]),
  );

/** One player intent as it crosses the wire; the engine still validates it against the state */
export const roomCommandSchema = z.custom<GameCommand>(value => {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    typeof value.type !== "string"
  )
    return false;
  return roomCommandSchemas[value.type]?.safeParse(value).success ?? false;
}, "Invalid command");
