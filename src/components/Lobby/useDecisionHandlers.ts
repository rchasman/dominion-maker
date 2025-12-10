import { useCallback } from "react";
import { uiLogger } from "../../lib/logger";
import { getDisplayState } from "./game-board-helpers";
import type { GameState } from "../../types/game-state";
import type { DecisionChoice } from "../../types/game-state";
import type { CommandResult } from "../../commands/types";

interface DecisionHandlersParams {
  validPreviewEventId: string | null;
  gameState: GameState | null;
  myGamePlayerId: string | null;
  selectedCardIndices: number[];
  setSelectedCardIndices: (updater: (prev: number[]) => number[]) => void;
  submitDecision: (choice: DecisionChoice) => CommandResult;
  getStateAtEvent: (eventId: string) => GameState;
}

export function useDecisionHandlers(params: DecisionHandlersParams) {
  const {
    validPreviewEventId,
    gameState,
    myGamePlayerId,
    selectedCardIndices,
    setSelectedCardIndices,
    submitDecision,
    getStateAtEvent,
  } = params;

  const handleSubmitDecision = useCallback(() => {
    const displayState = getDisplayState(
      validPreviewEventId,
      gameState,
      getStateAtEvent,
    );
    if (!displayState) return;
    const myPlayer = myGamePlayerId;
    const myPlayerState = myPlayer ? displayState.players[myPlayer] : null;
    if (!displayState.pendingDecision || !myPlayerState) return;

    const selectedCards = selectedCardIndices.map(i => myPlayerState.hand[i]);
    const result = submitDecision({ selectedCards });
    if (result.ok) {
      setSelectedCardIndices(() => []);
    } else {
      uiLogger.error("Failed to submit decision:", result.error);
    }
  }, [
    gameState,
    myGamePlayerId,
    selectedCardIndices,
    submitDecision,
    validPreviewEventId,
    getStateAtEvent,
    setSelectedCardIndices,
  ]);

  const handleSkipDecision = useCallback(() => {
    const displayState = getDisplayState(
      validPreviewEventId,
      gameState,
      getStateAtEvent,
    );
    if (!displayState?.pendingDecision?.canSkip) return;

    const result = submitDecision({ selectedCards: [] });
    if (result.ok) setSelectedCardIndices(() => []);
  }, [
    gameState,
    submitDecision,
    validPreviewEventId,
    getStateAtEvent,
    setSelectedCardIndices,
  ]);

  return { handleSubmitDecision, handleSkipDecision };
}
