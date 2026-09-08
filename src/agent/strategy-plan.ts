import { z } from "zod";

// Separate machine advice from display commentary. Bounds keep reused advice compact.
export const strategyPlanSchema = z.object({
  priority: z.string().min(1).max(240),
  conditions: z.array(z.string().min(1).max(160)).min(1).max(3),
});

export type StrategyPlan = z.infer<typeof strategyPlanSchema>;

export function parseStrategyPlan(value: unknown): StrategyPlan | undefined {
  const result = strategyPlanSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
