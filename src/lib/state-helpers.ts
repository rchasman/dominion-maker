import type { GameState, TurnSubPhase } from "../types/game-state";

/**
 * Derive the current turn sub-phase from pending state.
 * Replaces the redundant subPhase field with pure derivation.
 */
export function getSubPhase(state: GameState): TurnSubPhase {
  if (
    state.pendingChoice &&
    state.pendingChoice.playerId !== state.activePlayer
  ) {
    return "opponent_decision";
  }
  if (state.pendingChoice && state.pendingChoice.choiceType === "reaction") {
    return "awaiting_reaction";
  }
  return null;
}
