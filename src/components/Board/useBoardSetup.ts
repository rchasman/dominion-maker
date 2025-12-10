import { useState, useCallback } from "react";
import {
  useTypedGame,
  useCardSelection,
  usePreviewMode,
  useComplexDecision,
  useCardActions,
} from "./hooks";
import { useBoardHandlers } from "./useBoardHandlers";

export function useBoardSetup() {
  const game = useTypedGame();
  const {
    selectedCardIndices,
    clearSelection,
    toggleCardSelection,
    addCardSelection,
  } = useCardSelection();
  const { previewEventId, enterPreview, exitPreview, isPreviewMode } =
    usePreviewMode();
  const { complexDecisionData, updateComplexDecision, clearComplexDecision } =
    useComplexDecision();
  const { handlePlayAction, handlePlayTreasure, handleUnplayTreasure } =
    useCardActions();

  const [showDevtools, setShowDevtools] = useState(false);

  const onNewGame = useCallback(() => {
    exitPreview();
    clearSelection();
    game.startGame();
  }, [game, exitPreview, clearSelection]);

  const handleRequestUndo = useCallback(
    (eventId: string) => {
      exitPreview();
      clearSelection();
      game.requestUndo(eventId);
    },
    [game, exitPreview, clearSelection],
  );

  const {
    handleCardClick,
    handleInPlayClick,
    handleConfirmDecision,
    handleSkipDecision,
  } = useBoardHandlers({
    gameState: game.gameState,
    selectedCardIndices,
    toggleCardSelection,
    addCardSelection,
    clearSelection,
    clearComplexDecision,
    handlePlayAction,
    handlePlayTreasure,
    handleUnplayTreasure,
    submitDecision: game.submitDecision,
  });

  return {
    game,
    previewEventId,
    isPreviewMode,
    selectedCardIndices,
    complexDecisionData,
    updateComplexDecision,
    showDevtools,
    setShowDevtools,
    onNewGame,
    handleRequestUndo,
    enterPreview,
    handleCardClick,
    handleInPlayClick,
    handleConfirmDecision,
    handleSkipDecision,
  };
}
