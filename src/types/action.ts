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
 * Omit that distributes over union members, preserving each variant's
 * own fields (plain Omit collapses a union to its shared keys).
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** An Action's core signature: the action without its reasoning field */
export type ActionSignature = DistributiveOmit<Action, "reasoning">;

/**
 * Strip reasoning field from an action to get its core signature.
 * Also normalizes card field (removes if null/undefined) so equivalent
 * actions produce identical signatures.
 */
export function stripReasoning(action: Action): ActionSignature {
  if (action.type === "choose_from_options") {
    const { reasoning, ...rest } = action;
    void reasoning;
    return rest;
  }
  const { reasoning, ...rest } = action;
  void reasoning;
  const { card } = action;
  return card != null ? { ...rest, card } : rest;
}
