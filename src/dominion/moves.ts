import type { Action } from "../types/action";
import { hasCardField } from "../lib/action-utils";

/** One row of the numbered table: key order must stay choice, type, card */
export const promptRow = (move: Action): Record<string, string | number> => ({
  type: move.type,
  card: hasCardField(move) ? move.card : "",
});

export const withReasoning = (move: Action, reasoning: string): Action => ({
  ...move,
  reasoning,
});

export const reasoningOf = (move: Action): string | undefined => move.reasoning;
