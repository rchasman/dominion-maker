import { z } from "zod";
import { replayMoves } from "./rules";
import type { GoCommand, GoEvent, GoMove, GoOptions, GoState } from "./shape";
import { DEFAULT_GO_SIZE } from "./shape";

const playerId = z.string().min(1).max(200);
const playerOrder = z.tuple([playerId, playerId]);
const size = z.union([z.literal(9), z.literal(13), z.literal(19)]);
/** The largest board is 19 wide, so no coordinate reaches it */
const coordinate = z.number().int().min(0).max(18);
const point = { x: coordinate, y: coordinate };
const moveRecord = z.union([z.object(point), z.literal("pass")]);
const count = z.number().int().min(0);
/** The game's longest label is "T19", the shortest "A1" */
const label = z.string().regex(/^[A-HJ-T](1[0-9]|[1-9])$/);

export const goEventSchema: z.ZodType<GoEvent> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("GAME_INITIALIZED"),
    players: playerOrder,
    size,
    id: z.string().optional(),
  }),
  z.object({
    type: z.literal("STONE_PLACED"),
    playerId,
    ...point,
    id: z.string().optional(),
  }),
  z.object({
    type: z.literal("PASSED"),
    playerId,
    id: z.string().optional(),
  }),
  z.object({
    type: z.literal("RESIGNED"),
    playerId,
    id: z.string().optional(),
  }),
]);

export const goCommandSchema: z.ZodType<GoCommand> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("PLACE"), playerId, ...point }),
    z.object({ type: z.literal("PASS"), playerId }),
    z.object({ type: z.literal("RESIGN"), playerId }),
  ],
);

/**
 * A board its own move list does not produce is one no game played, so it
 * fails here rather than mislead the legal-move table built from it.
 */
const readablePosition = (state: {
  size: number;
  board: string;
  moves: GoState["moves"];
}): boolean => {
  if (state.board.length !== state.size * state.size) return false;
  try {
    return replayMoves(state.size, state.moves).board === state.board;
  } catch {
    return false;
  }
};

export const goStateSchema: z.ZodType<GoState> = z
  .object({
    size,
    board: z.string().regex(/^[.BW]*$/),
    playerOrder,
    moves: z.array(moveRecord).max(2000),
    captures: z.tuple([count, count]),
    consecutivePasses: count,
    gameOver: z.boolean(),
    winnerId: playerId.nullable(),
    result: z.enum(["score", "resignation"]).nullable(),
    score: z.object({ black: z.number(), white: z.number() }).nullable(),
  })
  .refine(readablePosition, "Unreadable position");

export const goMoveSchema: z.ZodType<GoMove> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("place"),
    ...point,
    label,
    reasoning: z.string().max(20000).optional(),
  }),
  z.object({
    kind: z.literal("pass"),
    label: z.literal("pass"),
    reasoning: z.string().max(20000).optional(),
  }),
]);

/**
 * The lobby starts a room with no options at all, so an empty object means
 * the small board; anything else sent alongside is a client bug.
 */
export const goOptionsSchema: z.ZodType<GoOptions> = z
  .object({ size: size.default(DEFAULT_GO_SIZE) })
  .strict();
