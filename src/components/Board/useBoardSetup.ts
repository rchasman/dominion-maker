import { useState, useCallback, useEffect } from "preact/hooks";
import {
  useCardSelection,
  usePreviewMode,
  useComplexDecision,
  useCardActions,
  useBuyCardHandler,
} from "./hooks";
import { useBoardHandlers } from "./useBoardHandlers";
import { preloadKingdomCards } from "../../lib/image-preload";
import type { CardName } from "../../types/game-state";
import { useSession } from "../../session/SessionContext";

export function useBoardSetup() {
  const session = useSession();
  const game = {
    gameState: session.gameState.value,
    events: session.events.value,
    endPhase: session.endPhase,
    playAllTreasures: session.playAllTreasures,
    submitDecision: session.submitDecision,
    revealReaction: session.revealReaction,
    declineReaction: session.declineReaction,
    hasPlayableActions: session.hasPlayableActions.value,
    hasTreasuresInHand: session.hasTreasuresInHand.value,
    appMode: session.mode,
    seats: session.seats.value,
    setSeat: session.setSeat,
    isProcessing: session.isProcessing.value,
    requestUndo: session.requestUndo,
    getStateAtEvent: session.getStateAtEvent,
    playerStrategies: session.playerStrategies.value,
    localPlayerId: session.localPlayerId.value,
    isSpectator: session.isSpectator.value,
  };
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
  const handleBuyCard = useBuyCardHandler();

  const [showDevtools, setShowDevtools] = useState(false);

  // Only a local table starts a new game from the board; a room's host starts it from the lobby
  const onNewGame = useCallback(() => {
    if (session.mode !== "local") return;
    exitPreview();
    clearSelection();
    session.startGame();
  }, [session, exitPreview, clearSelection]);

  const { requestUndo } = game;
  const handleRequestUndo = useCallback(
    (eventId: string) => {
      exitPreview();
      clearSelection();
      requestUndo(eventId);
    },
    [requestUndo, exitPreview, clearSelection],
  );

  const {
    handleCardClick,
    handleInPlayClick,
    handleConfirmDecision,
    handleSkipDecision,
    handleRevealReaction,
    handleDeclineReaction,
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
    revealReaction: game.revealReaction,
    declineReaction: game.declineReaction,
  });

  // Preload kingdom cards when game starts
  useEffect(() => {
    if (!game.gameState?.supply) return;

    const kingdomCards = Object.keys(game.gameState.supply).filter(
      card =>
        ![
          "Copper",
          "Silver",
          "Gold",
          "Estate",
          "Duchy",
          "Province",
          "Curse",
        ].includes(card),
    ) as CardName[];

    preloadKingdomCards(kingdomCards);
  }, [game.gameState?.supply]);

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
    handleRevealReaction,
    handleDeclineReaction,
    handleBuyCard,
  };
}
