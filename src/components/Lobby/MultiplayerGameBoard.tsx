/**
 * Multiplayer Game Board
 *
 * Full game board for multiplayer games using the event-driven engine.
 * Provides card interactions, action bar, and game state display.
 */
import { useCallback } from "preact/compat";
import { useMultiplayer } from "../../context/multiplayer-hooks";
import { getDisplayState } from "./game-board-helpers";
import { useGameBoardHandlers } from "./useGameBoardHandlers";
import { getDerivedGameState } from "./useDerivedGameState";
import { GameBoardContent } from "./GameBoardContent";

interface MultiplayerGameBoardProps {
  onBackToHome: () => void;
}

export function MultiplayerGameBoard({
  onBackToHome,
}: MultiplayerGameBoardProps) {
  const multiplayerContext = useMultiplayer();
  const {
    gameState,
    events,
    myGamePlayerId,
    isMyTurn,
    leaveRoom,
    endGame,
    players,
  } = multiplayerContext;

  const handlers = useGameBoardHandlers(
    {
      playAction: multiplayerContext.playAction,
      playTreasure: multiplayerContext.playTreasure,
      playAllTreasures: multiplayerContext.playAllTreasures,
      buyCard: multiplayerContext.buyCard,
      endPhase: multiplayerContext.endPhase,
      submitDecision: multiplayerContext.submitDecision,
      requestUndo: multiplayerContext.requestUndo,
      getStateAtEvent: multiplayerContext.getStateAtEvent,
    },
    { gameState, events, myGamePlayerId, isMyTurn },
  );

  const handleEndGame = useCallback(() => {
    if (confirm("End game for all players?")) {
      endGame();
    }
  }, [endGame]);

  const handleBackToHome = useCallback(() => {
    leaveRoom();
    onBackToHome();
  }, [leaveRoom, onBackToHome]);

  const displayState = getDisplayState(
    handlers.validPreviewEventId,
    gameState,
    multiplayerContext.getStateAtEvent,
  );

  if (!displayState) {
    return <div style={styles.loading}>Loading game...</div>;
  }

  const derivedState = getDerivedGameState({
    displayState,
    myGamePlayerId,
    isMyTurn,
    validPreviewEventId: handlers.validPreviewEventId,
  });

  return (
    <GameBoardContent
      displayState={displayState}
      events={events}
      isMyTurn={isMyTurn}
      myPlayer={derivedState.myPlayer}
      myVP={derivedState.myVP}
      canBuy={derivedState.canBuy}
      hintText={derivedState.hintText}
      isBuyPhase={derivedState.isBuyPhase}
      hasTreasuresInHand={derivedState.hasTreasuresInHand}
      selectedCardIndices={handlers.selectedCardIndices}
      validPreviewEventId={handlers.validPreviewEventId}
      showDevtools={handlers.showDevtools}
      players={players}
      myGamePlayerId={myGamePlayerId}
      onCardClick={handlers.handleCardClick}
      onBuyCard={handlers.handleBuyCard}
      onEndPhase={handlers.handleEndPhase}
      onPlayAllTreasures={handlers.handlePlayAllTreasures}
      onSubmitDecision={handlers.handleSubmitDecision}
      onSkipDecision={handlers.handleSkipDecision}
      onEndGame={handleEndGame}
      onBackToHome={handleBackToHome}
      onRequestUndo={handlers.handleRequestUndo}
      onToggleDevtools={() => handlers.setShowDevtools(!handlers.showDevtools)}
      onScrubEvent={handlers.setPreviewEventId}
      leaveRoom={leaveRoom}
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100dvh",
    color: "var(--color-text-secondary)",
  },
};
