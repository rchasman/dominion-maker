import { useState, useCallback } from "react";
import { uiLogger } from "../../lib/logger";
import { run } from "../../lib/run";
import { getDisplayState } from "./game-board-helpers";
import { useCardHandlers } from "./useCardHandlers";
import { useDecisionHandlers } from "./useDecisionHandlers";
import type { CardName, GameState } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { CommandResult } from "../../commands/types";
import type { DecisionChoice } from "../../types/game-state";

interface GameActions {
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;
  requestUndo: (toEventId: string, reason?: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
}

interface GameBoardState {
  gameState: GameState | null;
  events: GameEvent[];
  myGamePlayerId: string | null;
  isMyTurn: boolean;
}

export function useGameBoardHandlers(
  gameActions: GameActions,
  gameBoardState: GameBoardState
) {
  const {
    playAction,
    playTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
    requestUndo,
    getStateAtEvent,
  } = gameActions;
  const { gameState, events, myGamePlayerId, isMyTurn } = gameBoardState;

  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);
  const [showDevtools, setShowDevtools] = useState(false);

  const validPreviewEventId = run(() => {
    if (!previewEventId) return null;
    const found = events.find(e => e.id === previewEventId);
    return found ? previewEventId : null;
  });

  const handleRequestUndo = useCallback(
    (eventId: string) => {
      setPreviewEventId(null);
      setSelectedCardIndices([]);
      requestUndo(eventId);
    },
    [requestUndo]
  );

  const { handleCardClick, handleBuyCard } = useCardHandlers({
    validPreviewEventId,
    isMyTurn,
    gameState,
    selectedCardIndices,
    setSelectedCardIndices,
    playAction,
    playTreasure,
    buyCard,
    getStateAtEvent,
  });

  const { handleSubmitDecision, handleSkipDecision } = useDecisionHandlers({
    validPreviewEventId,
    gameState,
    myGamePlayerId,
    selectedCardIndices,
    setSelectedCardIndices,
    submitDecision,
    getStateAtEvent,
  });

  const handleEndPhase = useCallback(() => {
    if (validPreviewEventId !== null || !isMyTurn) return;
    const result = endPhase();
    if (!result.ok) uiLogger.error("Failed to end phase:", result.error);
  }, [isMyTurn, endPhase, validPreviewEventId]);

  const handlePlayAllTreasures = useCallback(() => {
    if (previewEventId !== null) return;
    const displayState = getDisplayState(previewEventId, gameState, getStateAtEvent);
    if (!displayState || !isMyTurn || displayState.phase !== "buy") return;

    const result = playAllTreasures();
    if (!result.ok) uiLogger.error("Failed to play treasures:", result.error);
  }, [previewEventId, isMyTurn, gameState, playAllTreasures, getStateAtEvent]);

  return {
    selectedCardIndices,
    previewEventId,
    setPreviewEventId,
    showDevtools,
    setShowDevtools,
    validPreviewEventId,
    handleRequestUndo,
    handleCardClick,
    handleBuyCard,
    handleEndPhase,
    handlePlayAllTreasures,
    handleSubmitDecision,
    handleSkipDecision,
  };
}
