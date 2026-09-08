import { z } from "zod";
import { cardNameSchema } from "../cards/program";
import type { ExecutionFrame } from "./execution-types";

const invocation = {
  card: cardNameSchema,
  playerId: z.string(),
  cause: z.string(),
  trigger: z.discriminatedUnion("type", [
    z.object({ type: z.literal("play") }).strict(),
    z.object({ type: z.literal("attack"), target: z.string() }).strict(),
    z
      .object({
        type: z.literal("reaction"),
        attacker: z.string(),
        attackCard: cardNameSchema,
      })
      .strict(),
  ]),
};

const frame: z.ZodType<ExecutionFrame> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("effect"), ...invocation }).strict(),
  z
    .object({ type: z.literal("choice"), ...invocation, memory: z.json() })
    .strict(),
  z
    .object({ type: z.literal("continue"), ...invocation, memory: z.json() })
    .strict(),
  z
    .object({
      type: z.literal("play"),
      card: cardNameSchema,
      playerId: z.string(),
      cause: z.string(),
      from: z.enum(["hand", "discard"]),
      times: z.number().int().positive().default(1),
    })
    .strict(),
  z
    .object({
      type: z.literal("attack"),
      card: cardNameSchema,
      playerId: z.string(),
      cause: z.string(),
      targets: z.array(z.string()),
      index: z.number().int().nonnegative(),
      phase: z.enum(["declare", "react", "afterReaction", "resolve"]),
      blocked: z.boolean(),
    })
    .strict(),
]);

export const executionStackSchema = z.array(frame);
