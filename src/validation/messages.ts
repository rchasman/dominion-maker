import { z } from "zod";
import { cardNameSchema } from "../cards/program";
import { executionStackSchema } from "../engine/execution-schema";
import {
  idSchema as id,
  cardsSchema as cards,
  decisionChoiceSchema,
  pendingChoiceSchema,
} from "./game-state";
import type { GameEvent } from "../events/types";
import type {
  GameClientMessage,
  LobbyClientMessage,
  GameUpdateMessage,
} from "../partykit/protocol";

const count = z.number().int().nonnegative();
const player = { playerId: id };
const card = { ...player, card: cardNameSchema };
const from = z.enum(["hand", "deck", "discard", "inPlay", "setAside"]);
const shape = {
  GAME_INITIALIZED: {
    players: z.array(id).min(2).max(4),
    kingdomCards: cards,
    supply: z.record(cardNameSchema, count),
    seed: z.number().optional(),
  },
  INITIAL_DECK_DEALT: { ...player, cards },
  INITIAL_HAND_DRAWN: { ...player, cards },
  TURN_STARTED: { ...player, turn: count },
  TURN_ENDED: { ...player, turn: count },
  PHASE_CHANGED: { phase: z.enum(["action", "buy", "cleanup"]) },
  CARD_DRAWN: card,
  CARD_PLAYED: {
    ...card,
    sourceIndex: z.number().int(),
    from: z.enum(["hand", "discard", "inPlay"]).optional(),
  },
  CARD_DISCARDED: { ...card, from },
  CARD_TRASHED: { ...card, from },
  CARD_GAINED: { ...card, to: z.enum(["hand", "discard", "deck"]) },
  CARD_REVEALED: { ...card, from },
  CARD_PEEKED: { ...card, from },
  DECK_SHUFFLED: { ...player, newDeckOrder: cards.optional() },
  CARD_PUT_ON_DECK: { ...card, from },
  CARD_RETURNED_TO_HAND: { ...card, from },
  CARD_SET_ASIDE: { ...card, from: z.literal("deck") },
  ACTIONS_MODIFIED: { delta: z.number().int() },
  BUYS_MODIFIED: { delta: z.number().int() },
  COINS_MODIFIED: { delta: z.number().int() },
  EFFECT_REGISTERED: {
    ...player,
    effectType: z.literal("cost_reduction"),
    source: cardNameSchema,
    parameters: z.object({ amount: z.number() }),
  },
  COST_MODIFIED: {
    card: cardNameSchema,
    baseCost: count,
    modifiedCost: count,
    modifiers: z.array(z.object({ source: cardNameSchema, delta: z.number() })),
  },
  ATTACK_DECLARED: {
    attacker: id,
    attackCard: cardNameSchema,
    targets: z.array(id),
  },
  ATTACK_RESOLVED: {
    attacker: id,
    target: id,
    attackCard: cardNameSchema,
    blocked: z.boolean(),
  },
  REACTION_PLAYED: { ...card, triggerEventId: id },
  REACTION_OPPORTUNITY: {
    ...player,
    triggeringPlayerId: id,
    triggeringCard: cardNameSchema,
    triggerType: z.enum(["on_attack", "on_gain", "on_trash", "on_discard"]),
    availableReactions: cards,
  },
  REACTION_REVEALED: { ...card, triggeringCard: cardNameSchema },
  REACTION_DECLINED: { ...player, triggeringCard: cardNameSchema },
  DECISION_REQUIRED: { decision: pendingChoiceSchema },
  DECISION_RESOLVED: { ...player, choice: decisionChoiceSchema },
  DECISION_SKIPPED: { ...player, cardBeingPlayed: cardNameSchema.optional() },
  GAME_ENDED: {
    winnerId: id.nullable(),
    scores: z.record(id, z.number().int()),
    reason: z.enum(["provinces_empty", "three_piles_empty"]),
  },
  UNDO_REQUESTED: {
    requestId: id,
    byPlayer: id,
    toEventId: id,
    reason: z.string().max(2000).optional(),
  },
  UNDO_APPROVED: { requestId: id, byPlayer: id },
  UNDO_DENIED: { requestId: id, byPlayer: id },
  UNDO_EXECUTED: { fromEventId: id, toEventId: id },
  RANDOM_STATE_UPDATED: { state: z.number() },
  TRIGGER_REGISTERED: { ...player, source: cardNameSchema },
  EXECUTION_UPDATED: { stack: executionStackSchema },
} satisfies Record<GameEvent["type"], z.ZodRawShape>;
const eventSchemas = Object.fromEntries(
  Object.entries(shape).map(([type, fields]) => [
    type,
    z
      .object({
        type: z.literal(type),
        id: id.optional(),
        causedBy: id.optional(),
        ...fields,
      })
      .strict(),
  ]),
);
export const gameEventSchema = z.custom<GameEvent>(value => {
  if (
    !value ||
    typeof value !== "object" ||
    !("type" in value) ||
    typeof value.type !== "string"
  )
    return false;
  return eventSchemas[value.type]?.safeParse(value).success ?? false;
});
const name = z.string().trim().min(1).max(80);
const token = z.string().min(20).max(200).optional();
const mode = z.enum(["engine", "hybrid", "full"]);
const gameMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    name,
    clientId: id.optional(),
    isBot: z.boolean().optional(),
    reconnectToken: token,
  }),
  z.object({ type: z.literal("spectate"), name, clientId: id.optional() }),
  z.object({
    type: z.literal("start_game"),
    kingdomCards: cards.optional(),
    botPlayerIds: z.array(id).optional(),
  }),
  z.object({
    type: z.literal("start_singleplayer"),
    botName: name.optional(),
    kingdomCards: cards.optional(),
    gameMode: mode.optional(),
  }),
  z.object({ type: z.literal("change_game_mode"), gameMode: mode }),
  z.object({
    type: z.literal("sync_events"),
    events: z.array(gameEventSchema).min(1).max(20000),
  }),
  ...(["play_action", "play_treasure", "buy_card"] as const).map(type =>
    z.object({ type: z.literal(type), card: cardNameSchema }),
  ),
  ...(["play_all_treasures", "end_phase", "resign", "leave"] as const).map(
    type => z.object({ type: z.literal(type) }),
  ),
  z.object({
    type: z.literal("submit_decision"),
    choice: decisionChoiceSchema,
  }),
  z.object({
    type: z.literal("request_undo"),
    toEventId: id,
    reason: z.string().max(2000).optional(),
  }),
  z.object({ type: z.literal("approve_undo"), requestId: id }),
  z.object({ type: z.literal("deny_undo"), requestId: id }),
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
  z.object({ type: z.literal("request_game"), targetId: id }),
  z.object({ type: z.literal("accept_request"), requestId: id }),
  z.object({ type: z.literal("cancel_request"), requestId: id }),
]);
export const lobbyMessageSchema = z.custom<LobbyClientMessage>(
  value => lobbyMessage.safeParse(value).success,
);
const gameUpdate = z.object({
  type: z.literal("game_update"),
  roomId: id,
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
