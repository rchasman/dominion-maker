import type { GameState, TurnSubPhase } from "../types/game-state";

/**
 * Derive the current turn sub-phase from pending state.
 * Replaces the redundant subPhase field with pure derivation.
 */
export function getSubPhase(state: GameState): TurnSubPhase {
  if (state.pendingReaction) {
    return "awaiting_reaction";
  }
  if (
    state.pendingDecision &&
    state.pendingDecision.player !== state.activePlayer
  ) {
    return "opponent_decision";
  }
  return null;
}
