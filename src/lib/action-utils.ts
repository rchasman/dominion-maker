import type { Action } from "../types/action";

/**
 * Check if an action has a card field (all actions except end_phase)
 */
export function hasCardField(
  action: Action,
): action is Action & { card: string } {
  return action.type !== "end_phase" && action.card !== undefined;
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
