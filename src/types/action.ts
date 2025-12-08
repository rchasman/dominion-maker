import type { CardName } from "./game-state";

export type Action = {
  /** The type of action to perform */
  type:
    | "play_action"
    | "play_treasure"
    | "buy_card"
    | "gain_card"
    | "discard_card"
    | "trash_card"
    | "end_phase";
  /** The card to act on (not needed for end_phase) */
  card?: CardName | null;
  /** Explanation for why this action was chosen */
  reasoning?: string;
};

/**
 * Strip reasoning field from an action to get its core signature.
 * Useful for comparing actions or creating action signatures.
 */
export function stripReasoning(action: Action): Omit<Action, "reasoning"> {
  const { reasoning: _reasoning, ...actionCore } = action;
  return actionCore;
}
