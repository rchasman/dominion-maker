import { z } from "zod";
import { cardNameSchema } from "../cards/program";
import { executionStackSchema } from "../engine/execution-schema";
import type { GameState } from "../types/game-state";

export const idSchema = z.string().min(1).max(200);
const count = z.number().int().nonnegative();
export const cardsSchema = z.array(cardNameSchema).max(1000);
const phase = z.enum(["action", "buy", "cleanup"]);
export const decisionChoiceSchema = z.object({
  choiceId: idSchema.optional(),
  selectedCards: cardsSchema,
  cardActions: z
    .record(
      z.string(),
      z.enum([
        "trash_card",
        "discard_card",
        "topdeck_card",
        "gain_card",
        "select",
        "skip",
        "reveal",
        "decline",
        "draw_card",
      ]),
    )
    .optional(),
  cardOrder: z
    .array(z.union([cardNameSchema, count]))
    .max(1000)
    .optional(),
});
export const pendingChoiceSchema = z.discriminatedUnion("choiceType", [
  z.object({
    choiceType: z.literal("decision"),
    playerId: idSchema,
    prompt: z.string().max(10000),
    cardOptions: cardsSchema,
    cardBeingPlayed: cardNameSchema,
    intent: z
      .enum([
        "trash",
        "discard",
        "gain",
        "topdeck",
        "play",
        "organize",
        "keep",
        "select",
      ])
      .optional(),
    from: z
      .enum(["hand", "supply", "revealed", "options", "discard"])
      .optional(),
    min: count.optional(),
    max: count.optional(),
    presentation: z.object({ currentRoundIndex: count.optional() }).optional(),
    requiresOrdering: z.boolean().optional(),
    orderingPrompt: z.string().max(10000).optional(),
    actions: z
      .array(
        z.object({
          id: z.enum([
            "trash_card",
            "discard_card",
            "topdeck_card",
            "gain_card",
            "select",
            "skip",
            "reveal",
            "decline",
            "draw_card",
          ]),
          label: z.string(),
          color: z.string(),
          isDefault: z.boolean().optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    choiceType: z.literal("reaction"),
    playerId: idSchema,
    triggeringPlayerId: idSchema,
    triggeringCard: cardNameSchema,
    triggerType: z.enum(["on_attack", "on_gain", "on_trash", "on_discard"]),
    availableReactions: cardsSchema,
  }),
]);

const logEntry: z.ZodType = z.lazy(() =>
  z
    .object({
      type: z.enum([
        "turn-start",
        "turn-end",
        "phase-change",
        "play-treasure",
        "unplay-treasure",
        "play-action",
        "buy-card",
        "draw-cards",
        "gain-card",
        "discard-cards",
        "trash-card",
        "shuffle-deck",
        "end-turn",
        "game-over",
        "start-game",
        "text",
        "get-actions",
        "get-buys",
        "use-actions",
        "use-buys",
        "get-coins",
        "spend-coins",
        "reveal-card",
      ]),
      playerId: idSchema.optional(),
      turn: count.optional(),
      card: z.string().max(1000).optional(),
      cards: cardsSchema.optional(),
      eventId: idSchema.optional(),
      children: z.array(logEntry).max(20000).optional(),
    })
    .passthrough()
    .superRefine((entry, ctx) => {
      if (!["text", "game-over"].includes(entry.type) && !entry.playerId)
        ctx.addIssue({ code: "custom", message: "playerId required" });
      if (entry.type === "turn-start" && entry.turn === undefined)
        ctx.addIssue({ code: "custom", message: "turn required" });
    }),
);
const player = z.object({
  hand: cardsSchema,
  deck: cardsSchema,
  discard: cardsSchema,
  inPlay: cardsSchema,
  inPlaySourceIndices: z.array(z.number().int()),
  setAside: cardsSchema.optional(),
  deckTopRevealed: z.boolean().optional(),
  publicCards: cardsSchema.optional(),
  handCount: count.optional(),
  deckCount: count.optional(),
  handHidden: z.boolean().optional(),
});
const state = z
  .object({
    turn: count,
    phase,
    activePlayerId: idSchema,
    players: z.record(idSchema, player),
    supply: z.record(cardNameSchema, count),
    trash: cardsSchema,
    kingdomCards: cardsSchema,
    actions: z.number().int(),
    buys: z.number().int(),
    coins: z.number().int(),
    pendingChoice: pendingChoiceSchema.nullable(),
    pendingChoiceEventId: idSchema.nullable(),
    gameOver: z.boolean(),
    winnerId: idSchema.nullable(),
    log: z.array(logEntry).max(20000),
    turnHistory: z.array(
      z.object({
        type: z.enum([
          "play_action",
          "play_treasure",
          "buy_card",
          "end_phase",
          "discard_card",
          "trash_card",
          "gain_card",
        ]),
        card: cardNameSchema.nullable().optional(),
      }),
    ),
    activeEffects: z.array(
      z.object({
        type: z.literal("EFFECT_REGISTERED"),
        playerId: idSchema,
        effectType: z.literal("cost_reduction"),
        source: cardNameSchema,
        parameters: z.object({ amount: z.number() }),
      }),
    ),
    playerOrder: z.array(idSchema).min(2).max(4),
    randomState: z.number().optional(),
    executionStack: executionStackSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      !Object.hasOwn(value.players, value.activePlayerId) ||
      value.playerOrder.some(id => !Object.hasOwn(value.players, id)) ||
      (value.pendingChoice &&
        !Object.hasOwn(value.players, value.pendingChoice.playerId))
    )
      ctx.addIssue({ code: "custom", message: "Unknown player" });
  });
// Preserve typed optional engine/display metadata after validating the consumed structure.
export const gameStateSchema = z.custom<GameState>(
  value => state.safeParse(value).success,
  "Invalid game state",
);
