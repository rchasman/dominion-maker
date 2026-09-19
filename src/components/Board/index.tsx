import { useMemo } from "preact/hooks";
import { computeBoardState, type BoardState } from "./boardStateHelpers";
import { createBoardCallbacks } from "./useBoardCallbacks";
import { createGameProps } from "./createGameProps";
import { useBoardSetup } from "./useBoardSetup";
import { BoardContent } from "./BoardContent";
import { usePreviewState } from "./usePreviewState";

interface BoardProps {
  onBackToHome?: () => void;
}

export function Board({ onBackToHome }: BoardProps) {
  const {
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
    handleRevealReaction,
    handleDeclineReaction,
    handleBuyCard,
  } = useBoardSetup();

  const preview = usePreviewState(previewEventId, game.getStateAtEvent);

  const boardState: BoardState | null = useMemo(() => {
    if (!game.gameState) return null;
    return computeBoardState({
      state: game.gameState,
      previewEventId,
      isPreviewMode,
      seats: game.seats,
      hasPlayableActions: game.hasPlayableActions,
      hasTreasuresInHand: game.hasTreasuresInHand,
      getStateAtEvent: () => preview.state ?? game.gameState!,
      localPlayerId: game.localPlayerId,
      isSpectator: game.isSpectator ?? false,
    });
  }, [
    game.gameState,
    previewEventId,
    isPreviewMode,
    game.seats,
    game.hasPlayableActions,
    game.hasTreasuresInHand,
    preview.state,
    game.localPlayerId,
    game.isSpectator,
  ]);

  const gameState = game.gameState;
  if (!boardState || !gameState) return null;

  const localPlayerId = boardState.localPlayerId;

  const hasPendingDecision =
    !boardState.isLocalPlayerAI &&
    !!boardState.displayState.pendingChoice &&
    boardState.displayState.pendingChoice.playerId === localPlayerId;

  const callbacks = createBoardCallbacks({
    isPreviewMode,
    isLocalPlayerTurn: boardState.canLocalPlayerAct,
    hasPendingDecision,
    localPlayerId,
    phase: boardState.displayState.phase,
    handleCardClick,
    handleInPlayClick,
    handleConfirmDecision,
    handleSkipDecision,
    playAllTreasures: game.playAllTreasures,
    endPhase: game.endPhase,
  });

  const gameProps = createGameProps({
    events: game.events,
    isProcessing: game.isProcessing,
    appMode: game.appMode,
    seats: game.seats,
    setSeat: game.setSeat,
    playerStrategies: game.playerStrategies,
    buyCard: handleBuyCard,
    playAllTreasures: game.playAllTreasures,
    endPhase: game.endPhase,
    hasTreasuresInHand: game.hasTreasuresInHand,
    gameState,
  });

  return (
    <BoardContent
      boardState={boardState}
      game={gameProps}
      isPreviewMode={isPreviewMode}
      previewError={preview.error}
      selectedCardIndices={selectedCardIndices}
      complexDecisionData={complexDecisionData}
      showDevtools={showDevtools}
      onToggleDevtools={() => setShowDevtools(!showDevtools)}
      onNewGame={onNewGame}
      {...(onBackToHome !== undefined && { onBackToHome })}
      onRequestUndo={handleRequestUndo}
      onScrub={enterPreview}
      onCardClick={callbacks.onCardClick}
      onInPlayClick={callbacks.onInPlayClick}
      onPlayAllTreasures={callbacks.onPlayAllTreasures}
      onEndPhase={callbacks.onEndPhase}
      onConfirmDecision={callbacks.onConfirmDecision}
      onSkipDecision={callbacks.onSkipDecision}
      onRevealReaction={handleRevealReaction}
      onDeclineReaction={handleDeclineReaction}
      onComplexDecisionChange={updateComplexDecision}
    />
  );
}
