import type { CardName, GameState } from "../types/game-state";
import { isDecisionChoice } from "../types/pending-choice";

const DEFAULT_DECISION_MAX = 999;

/**
 * Check if a decision can be skipped (has min = 0).
 */
export function canSkipDecision(decision: GameState["pendingChoice"]): boolean {
  return isDecisionChoice(decision) ? (decision.min ?? 1) === 0 : false;
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
  const max = isDecisionChoice(pendingChoice)
    ? (pendingChoice.max ?? DEFAULT_DECISION_MAX)
    : DEFAULT_DECISION_MAX;
  const isAlreadySelected = selectedCardIndices.includes(cardIndex);

  return {
    shouldToggleOff: isAlreadySelected,
    canAdd: !isAlreadySelected && selectedCardIndices.length < max,
  };
}

/**
 * Selected indices point into the hand for hand choices and into
 * `cardOptions` for every other source (discard, revealed, options).
 */
export function selectsFromHand(
  pendingChoice: GameState["pendingChoice"] | undefined,
): boolean {
  if (!isDecisionChoice(pendingChoice)) return true;
  return pendingChoice.from === undefined || pendingChoice.from === "hand";
}

export function resolveSelectedCards(
  pendingChoice: GameState["pendingChoice"],
  hand: CardName[],
  selectedCardIndices: number[],
): CardName[] {
  const source =
    isDecisionChoice(pendingChoice) && !selectsFromHand(pendingChoice)
      ? pendingChoice.cardOptions
      : hand;
  return selectedCardIndices
    .map(i => source[i])
    .filter((card): card is CardName => card !== undefined);
}
