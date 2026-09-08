import type { GameState } from "../../types/game-state";
import { useMemo, useEffect, useState } from "preact/hooks";
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

  const getStateAtEvent = game.getStateAtEvent;
  const [preview, setPreview] = useState<{
    eventId: string;
    state?: GameState;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!previewEventId) {
      setPreview(null);
      return;
    }
    const request = { active: true };
    setPreview({ eventId: previewEventId });
    void Promise.resolve()
      .then(() => getStateAtEvent(previewEventId))
      .then(state => {
        if (request.active) setPreview({ eventId: previewEventId, state });
      })
      .catch((error: unknown) => {
        if (request.active)
          setPreview({
            eventId: previewEventId,
            error:
              error instanceof Error ? error.message : "Preview unavailable",
          });
      });
    return () => {
      request.active = false;
    };
  }, [previewEventId, getStateAtEvent]);

  const boardState: BoardState | null = useMemo(() => {
    if (!game.gameState) return null;
    return computeBoardState({
      state: game.gameState,
      previewEventId,
      isPreviewMode,
      gameMode: game.gameMode,
      hasPlayableActions: game.hasPlayableActions,
      hasTreasuresInHand: game.hasTreasuresInHand,
      getStateAtEvent: () =>
        preview?.eventId === previewEventId && preview.state
          ? preview.state
          : game.gameState!,
      localPlayerId: game.localPlayerId,
      isSpectator: game.isSpectator ?? false,
    });
  }, [
    game.gameState,
    previewEventId,
    isPreviewMode,
    game.gameMode,
    game.hasPlayableActions,
    game.hasTreasuresInHand,
    preview,
    game.localPlayerId,
    game.isSpectator,
  ]);

  const gameState = game.gameState;
  if (!boardState || !gameState) return null;

  const localPlayerId = boardState.localPlayerId;

  const hasPendingDecision =
    !!boardState.displayState.pendingChoice &&
    boardState.displayState.pendingChoice.playerId === localPlayerId;

  const callbacks = createBoardCallbacks({
    isPreviewMode,
    isLocalPlayerTurn: boardState.isLocalPlayerTurn,
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
    gameMode: game.gameMode,
    setGameMode: game.setGameMode,
    modelSettings: game.modelSettings,
    setModelSettings: game.setModelSettings,
    playerStrategies: game.playerStrategies,
    buyCard: handleBuyCard,
    playAllTreasures: game.playAllTreasures,
    endPhase: game.endPhase,
    hasTreasuresInHand: game.hasTreasuresInHand,
    gameState,
  });

  if (
    previewEventId &&
    (preview?.eventId !== previewEventId || !preview.state)
  ) {
    return (
      <div role="status">
        {preview?.error ?? "Loading history…"}
        <button onClick={() => enterPreview(null)}>Return to game</button>
      </div>
    );
  }

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
