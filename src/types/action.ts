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
    | "topdeck_card"
    | "skip_decision"
    | "end_phase";
  /** The card to act on (not needed for end_phase or skip_decision) */
  card?: CardName | null;
  /** Explanation for why this action was chosen */
  reasoning?: string;
};

/**
 * Strip reasoning field from an action to get its core signature.
 * Also normalizes card field (removes if null/undefined) so equivalent
 * actions produce identical signatures.
 */
export function stripReasoning(action: Action): Omit<Action, "reasoning"> {
  const { reasoning, card, ...rest } = action;
  void reasoning;
  return card != null ? { ...rest, card } : rest;
}
