import { z } from "zod";
import { gameIdSchema } from "../games";
import { idSchema as id } from "./game-state";
import { botConfigSchema, controllerConfigSchema, seatsSchema } from "./seats";
import type {
  GameClientMessage,
  LobbyClientMessage,
  GameUpdateMessage,
} from "../partykit/protocol";

const count = z.number().int().nonnegative();
const name = z.string().trim().min(1).max(80);
const token = z.string().min(20).max(200).optional();
const gameMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    name,
    game: gameIdSchema,
    clientId: id.optional(),
    isBot: z.boolean().optional(),
    reconnectToken: token,
  }),
  z.object({
    type: z.literal("spectate"),
    name,
    game: gameIdSchema,
    clientId: id.optional(),
  }),
  z.object({
    type: z.literal("start_game"),
    options: z.unknown().optional(),
    bots: z
      .array(z.object({ name, controller: botConfigSchema }))
      .max(3)
      .optional(),
  }),
  z.object({ type: z.literal("start_singleplayer"), seats: seatsSchema }),
  z.object({
    type: z.literal("set_seat"),
    playerId: id,
    controller: controllerConfigSchema,
  }),
  z.object({
    type: z.literal("sync_events"),
    events: z.array(z.unknown()).min(1).max(20000),
  }),
  /** The room's module validates the payload; the protocol only routes it */
  z.object({ type: z.literal("command"), command: z.unknown() }),
  ...(["resign", "leave"] as const).map(type =>
    z.object({ type: z.literal(type) }),
  ),
  z.object({ type: z.literal("preview_state"), eventId: id }),
  z.object({
    type: z.literal("chat"),
    message: z.object({
      id,
      senderName: name,
      content: z.string().trim().min(1).max(4000),
      timestamp: z.number(),
    }),
  }),
]);
export const gameMessageSchema = z.custom<GameClientMessage>(
  value => gameMessage.safeParse(value).success,
);
const lobbyMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join_lobby"), name, clientId: id }),
  z.object({
    type: z.literal("request_game"),
    targetId: id,
    game: gameIdSchema,
  }),
  z.object({ type: z.literal("accept_request"), requestId: id }),
  z.object({ type: z.literal("cancel_request"), requestId: id }),
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
      z.object({
        name,
        isBot: z.boolean().optional(),
        id: id.optional(),
        isConnected: z.boolean().optional(),
      }),
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
