/**
 * Reading a log entry's `data`.
 *
 * The payload is whatever the acting game put there, and in a room it crossed
 * the wire, so every field is checked on the way out rather than asserted.
 * A field that is missing or the wrong shape reads as undefined, which is what
 * every caller already handles.
 */
import { z } from "zod";
import type { Action } from "../../../types/action";
import type { TokenUsage } from "../../../core/consensus/cost";
import type { ModelProvider } from "../../../config/models";
import { MODEL_IDS } from "../../../config/models";
import type { GameStateSnapshot, LoggedVote, PendingData } from "../types";

export const readString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

export const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;

export const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === "boolean" ? value : undefined;

export const readProvider = (value: unknown): ModelProvider | undefined =>
  MODEL_IDS.find(id => id === value);

/** Only the move's own game can judge its shape; the viewer checks it is one */
const moveSchema = z.custom<Action>(
  value => typeof value === "object" && value !== null,
);

const snapshotSchema = z.custom<GameStateSnapshot>(
  value => typeof value === "object" && value !== null,
);

const voteSchema: z.ZodType<LoggedVote> = z.object({
  move: moveSchema,
  weight: z.number(),
  key: z.string().optional(),
  label: z.string().optional(),
});

/**
 * A roster saved before a model was retired still names it. Dropping the one
 * name is right; dropping the whole pending view over it is not.
 */
const rosterSchema = z.array(z.unknown()).transform(list =>
  list.flatMap(value => {
    const provider = readProvider(value);
    return provider === undefined ? [] : [provider];
  }),
);

const pendingSchema: z.ZodType<PendingData> = z.object({
  providers: rosterSchema,
  totalModels: z.number(),
  phase: z.string(),
  gameState: snapshotSchema.optional(),
  legalKeys: z.array(z.string()).optional(),
});

const usageSchema: z.ZodType<TokenUsage> = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
});

export const readMove = (value: unknown): Action | undefined =>
  moveSchema.safeParse(value).data;

export const readVotes = (value: unknown): LoggedVote[] | undefined =>
  z.array(voteSchema).safeParse(value).data;

export const readPending = (value: unknown): PendingData | undefined =>
  pendingSchema.safeParse(value).data;

export const readUsage = (value: unknown): TokenUsage | undefined =>
  usageSchema.safeParse(value).data;
