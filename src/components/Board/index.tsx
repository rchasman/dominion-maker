import { computeBoardState, type BoardState } from "./boardStateHelpers";
import { createBoardCallbacks } from "./useBoardCallbacks";
import { createGameProps } from "./createGameProps";
import { useBoardSetup } from "./useBoardSetup";
import { BoardContent } from "./BoardContent";

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

  if (!game.gameState) return null;

  const boardState: BoardState = computeBoardState({
    state: game.gameState,
    previewEventId,
    isPreviewMode,
    gameMode: game.gameMode,
    hasPlayableActions: game.hasPlayableActions,
    hasTreasuresInHand: game.hasTreasuresInHand,
    getStateAtEvent: game.getStateAtEvent,
    localPlayerId: game.localPlayerId,
    isSpectator: game.isSpectator,
  });

  const mainPlayerId = boardState.mainPlayerId;

  const callbacks = createBoardCallbacks({
    isPreviewMode,
    isMainPlayerTurn: boardState.isMainPlayerTurn,
    mainPlayerId,
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
    gameMode: game.gameMode,
    setGameMode: game.setGameMode,
    modelSettings: game.modelSettings,
    setModelSettings: game.setModelSettings,
    playerStrategies: game.playerStrategies,
    buyCard: handleBuyCard,
    playAllTreasures: game.playAllTreasures,
    endPhase: game.endPhase,
    hasTreasuresInHand: game.hasTreasuresInHand,
    gameState: game.gameState,
  });

  return (
    <BoardContent
      boardState={boardState}
      game={gameProps}
      isPreviewMode={isPreviewMode}
      selectedCardIndices={selectedCardIndices}
      complexDecisionData={complexDecisionData}
      showDevtools={showDevtools}
      onToggleDevtools={() => setShowDevtools(!showDevtools)}
      onNewGame={onNewGame}
      onBackToHome={onBackToHome}
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
