import type { Action } from "../types/action";

/**
 * Check if an action has a card field (all actions except end_phase and skip_decision)
 */
export function hasCardField(
  action: Action,
): action is Exclude<
  Action,
  { type: "end_phase" | "skip_decision" | "choose_from_options" }
> & { card: string } {
  return (
    action.type !== "end_phase" &&
    action.type !== "skip_decision" &&
    action.type !== "choose_from_options" &&
    "card" in action &&
    action.card !== undefined
  );
}

/**
 * Format an action as a readable string for logging/display
 */
export function formatActionDescription(action: Action): string {
  if (hasCardField(action)) {
    return `${action.type}(${action.card})`;
  }
  return action.type;
}
