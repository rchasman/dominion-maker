import type { CardName } from "./game-state";

export type Action =
  | {
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
        | "end_phase"
        | "reveal_reaction"
        | "decline_reaction";
      /** The card to act on (not needed for end_phase, skip_decision, or decline_reaction) */
      card?: CardName | null;
      /** Explanation for why this action was chosen */
      reasoning?: string;
    }
  | {
      /** Choose from predefined options */
      type: "choose_from_options";
      /** Index of the option to choose */
      optionIndex: number;
      /** Explanation for why this action was chosen */
      reasoning?: string;
    };

/**
 * Strip reasoning field from an action to get its core signature.
 * Also normalizes card field (removes if null/undefined) so equivalent
 * actions produce identical signatures.
 */
export function stripReasoning(action: Action): Omit<Action, "reasoning"> {
  const { reasoning, ...rest } = action;
  void reasoning;
  if (action.type === "choose_from_options") {
    return rest as Omit<Action, "reasoning">;
  }
  const { card } = action;
  return card != null ? { ...rest, card } : (rest as Omit<Action, "reasoning">);
}
