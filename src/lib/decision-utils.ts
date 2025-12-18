import type { GameState } from "../types/game-state";

const DEFAULT_DECISION_MAX = 999;

/**
 * Check if a decision can be skipped (has min = 0).
 */
export function canSkipDecision(
  decision: GameState["pendingChoice"],
): boolean {
  return (decision?.min ?? 1) === 0;
}

/**
 * Determine if selecting a card should toggle it off or add it to selection.
 * Used for multi-card selection in decisions.
 */
export function shouldSelectCard(
  cardIndex: number,
  selectedCardIndices: number[],
  pendingChoice: GameState["pendingChoice"],
): { shouldToggleOff: boolean; canAdd: boolean } {
  const max = pendingChoice?.max ?? DEFAULT_DECISION_MAX;
  const isAlreadySelected = selectedCardIndices.includes(cardIndex);

  return {
    shouldToggleOff: isAlreadySelected,
    canAdd: !isAlreadySelected && selectedCardIndices.length < max,
  };
}
