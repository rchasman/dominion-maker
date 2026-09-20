import { z } from "zod";
import { gameIdSchema } from "../game-ids";
import { idSchema as id } from "./game-state";
import { botConfigSchema, controllerConfigSchema, seatsSchema } from "./seats";
import { LLM_LOG_ENTRY_TYPES } from "../core/consensus/types";
import type { LLMLogEntry } from "../core/consensus/types";
import type {
  GameClientMessage,
  LobbyClientMessage,
  GameUpdateMessage,
} from "../partykit/protocol";

const count = z.number().int().nonnegative();
const name = z.string().trim().min(1).max(80);
const token = z.string().min(20).max(200).optional();
const gameMessage = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("join"),
      name,
      game: gameIdSchema,
      clientId: id.optional(),
      isBot: z.boolean().optional(),
      reconnectToken: token,
    })
    .strict(),
  z
    .object({
      type: z.literal("spectate"),
      name,
      game: gameIdSchema,
      clientId: id.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("start_game"),
      options: z.unknown().optional(),
      bots: z
        .array(z.object({ name, controller: botConfigSchema }).strict())
        .max(3)
        .optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("start_singleplayer"),
      seats: seatsSchema,
      options: z.unknown().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("set_seat"),
      playerId: id,
      controller: controllerConfigSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("sync_events"),
      events: z.array(z.unknown()).min(1).max(20000),
    })
    .strict(),
  /** The room's module validates the payload; the protocol only routes it */
  z.object({ type: z.literal("command"), command: z.unknown() }).strict(),
  ...(["resign", "leave"] as const).map(type =>
    z.object({ type: z.literal(type) }).strict(),
  ),
  z.object({ type: z.literal("preview_state"), eventId: id }).strict(),
  z
    .object({
      type: z.literal("chat"),
      message: z
        .object({
          id,
          senderName: name,
          content: z.string().trim().min(1).max(4000),
          timestamp: z.number(),
        })
        .strict(),
    })
    .strict(),
]);
export const gameMessageSchema = z.custom<GameClientMessage>(
  value => gameMessage.safeParse(value).success,
);
/** The entry a room relays; its `data` stays the acting game's business */
const consensusLogEntry = z
  .object({
    id,
    timestamp: z.number(),
    type: z.enum(LLM_LOG_ENTRY_TYPES),
    message: z.string().max(10000),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export const consensusLogEntrySchema = z.custom<LLMLogEntry>(
  value => consensusLogEntry.safeParse(value).success,
);

const lobbyMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join_lobby"), name, clientId: id }).strict(),
  z
    .object({
      type: z.literal("request_game"),
      targetId: id,
      game: gameIdSchema,
    })
    .strict(),
  z.object({ type: z.literal("accept_request"), requestId: id }).strict(),
  z.object({ type: z.literal("cancel_request"), requestId: id }).strict(),
]);
export const lobbyMessageSchema = z.custom<LobbyClientMessage>(
  value => lobbyMessage.safeParse(value).success,
);
const gameUpdate = z.object({
  type: z.literal("game_update"),
  roomId: id,
  game: gameIdSchema,
  players: z
    .array(
      z
        .object({
          name,
          isBot: z.boolean().optional(),
          id: id.optional(),
          isConnected: z.boolean().optional(),
        })
        .strict(),
    )
    .max(4),
  spectatorCount: count,
  isActive: z.boolean(),
  isSinglePlayer: z.boolean(),
});
export const gameUpdateSchema = z.custom<GameUpdateMessage>(
  value => gameUpdate.safeParse(value).success,
);
export function parseMessage<T>(
  message: string,
  schema: z.ZodType<T>,
): T | null {
  if (message.length > 2_000_000) return null;
  try {
    const input: unknown = JSON.parse(message);
    const result = schema.safeParse(input);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
