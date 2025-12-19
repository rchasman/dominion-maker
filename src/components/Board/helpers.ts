import type { GameState, PlayerId } from "../../types/game-state";
import { isDecisionChoice, isReactionChoice } from "../../types/pending-choice";

interface GetHintTextParams {
  displayState: GameState;
  localPlayerId: PlayerId;
  isLocalPlayerTurn: boolean;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
}

export function getHintText({
  displayState,
  localPlayerId,
  isLocalPlayerTurn,
  hasPlayableActions,
  hasTreasuresInHand,
}: GetHintTextParams): string {
  // Check for pending reaction first
  if (
    isReactionChoice(displayState.pendingChoice) &&
    displayState.pendingChoice.playerId === localPlayerId
  ) {
    const { attackCard, attacker } = displayState.pendingChoice;
    return `${attacker} played ${attackCard}. Reveal a reaction?`;
  }

  if (
    isDecisionChoice(displayState.pendingChoice) &&
    displayState.pendingChoice.playerId === localPlayerId
  ) {
    return displayState.pendingChoice.prompt;
  }

  if (!isLocalPlayerTurn) {
    return "Opponent is playing...";
  }

  if (displayState.phase === "action") {
    return hasPlayableActions ? "Click an Action card to play it" : "";
  }

  if (displayState.phase === "buy") {
    const localPlayer = displayState.players[localPlayerId];
    const hasInPlayTreasures = (localPlayer?.inPlay.length ?? 0) > 0;

    if (displayState.coins === 0 && hasTreasuresInHand) {
      return "Play treasures to get coins";
    }

    if (hasInPlayTreasures) {
      return "Click played treasures to take back";
    }

    return "";
  }

  return "";
}
