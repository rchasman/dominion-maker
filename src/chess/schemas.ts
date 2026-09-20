import { validateFen } from "chess.js";
import { z } from "zod";
import type {
  ChessCommand,
  ChessEvent,
  ChessMove,
  ChessOptions,
  ChessState,
} from "./shape";

const playerId = z.string().min(1).max(200);
const san = z.string().min(1).max(10);
const playerOrder = z.tuple([playerId, playerId]);
const square = z.string().regex(/^[a-h][1-8]$/);
const piece = z.enum(["p", "n", "b", "r", "q", "k"]);

export const chessEventSchema: z.ZodType<ChessEvent> = z.discriminatedUnion(
  "type",
  [
    z.object({
      type: z.literal("GAME_INITIALIZED"),
      players: playerOrder,
      id: z.string().optional(),
    }),
    z.object({
      type: z.literal("MOVE"),
      playerId,
      san,
      id: z.string().optional(),
    }),
    z.object({
      type: z.literal("RESIGNED"),
      playerId,
      id: z.string().optional(),
    }),
  ],
);

export const chessCommandSchema: z.ZodType<ChessCommand> = z.discriminatedUnion(
  "type",
  [
    z.object({ type: z.literal("MOVE"), playerId, san }),
    z.object({ type: z.literal("RESIGN"), playerId }),
  ],
);

/** A position chess.js refuses is one no board can draw, so it fails here */
const readableFen = (fen: string): boolean => validateFen(fen).ok;

export const chessStateSchema: z.ZodType<ChessState> = z.object({
  fen: z.string().min(1).max(200).refine(readableFen, "Unreadable position"),
  playerOrder,
  moves: z.array(san).max(2000),
  gameOver: z.boolean(),
  winnerId: playerId.nullable(),
  result: z.enum(["checkmate", "stalemate", "draw", "resignation"]).nullable(),
  inCheck: z.boolean(),
});

export const chessMoveSchema: z.ZodType<ChessMove> = z.object({
  san,
  from: square,
  to: square,
  promotion: piece.optional(),
  captured: piece.optional(),
  reasoning: z.string().max(20000).optional(),
});

/** Chess takes no setup at all, so anything sent alongside is a client bug */
export const chessOptionsSchema: z.ZodType<ChessOptions> = z
  .object({})
  .strict();
