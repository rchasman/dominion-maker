import { z } from "zod";
import { MODEL_MAP, type ModelProvider } from "../config/models";

const modelId = z.custom<ModelProvider>(
  value => typeof value === "string" && Object.hasOwn(MODEL_MAP, value),
  "Unknown model id",
);

export const humanSeatSchema = z.object({ kind: z.literal("human") });
export const heuristicSeatSchema = z.object({ kind: z.literal("heuristic") });
export const llmSeatSchema = z.object({
  kind: z.literal("llm"),
  models: z.array(modelId).max(50),
  consensusCount: z.number().int().min(1).max(50),
  customStrategy: z.string().max(20000),
});

export const controllerConfigSchema = z.discriminatedUnion("kind", [
  humanSeatSchema,
  heuristicSeatSchema,
  llmSeatSchema,
]);

/** Seats a bot may hold: everything except human */
export const botConfigSchema = z.discriminatedUnion("kind", [
  heuristicSeatSchema,
  llmSeatSchema,
]);

export const seatsSchema = z.record(
  z.string().min(1).max(200),
  controllerConfigSchema,
);
