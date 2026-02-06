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
import type { CommandResult } from "../../commands/types";
import {
  gameState$,
  events$,
  endPhase$,
  playAllTreasures$,
  submitDecision$,
  revealReaction$,
  declineReaction$,
  hasPlayableActions$,
  hasTreasuresInHand$,
  gameMode$,
  setGameMode$,
  startGame$,
  isProcessing$,
  modelSettings$,
  setModelSettings$,
  requestUndo$,
  getStateAtEvent$,
  playerStrategies$,
  localPlayerId$,
  isSpectator$,
} from "../../context/game-signals";

const uninitializedCommand = (): CommandResult => ({
  ok: false,
  error: "Game not initialized",
});

export function useBoardSetup() {
  const game = {
    gameState: gameState$.value,
    events: events$.value,
    endPhase: endPhase$.value ?? uninitializedCommand,
    playAllTreasures: playAllTreasures$.value ?? uninitializedCommand,
    submitDecision: submitDecision$.value ?? uninitializedCommand,
    revealReaction: revealReaction$.value ?? uninitializedCommand,
    declineReaction: declineReaction$.value ?? uninitializedCommand,
    hasPlayableActions: hasPlayableActions$.value,
    hasTreasuresInHand: hasTreasuresInHand$.value,
    gameMode: gameMode$.value,
    setGameMode: setGameMode$.value ?? undefined,
    startGame: startGame$.value ?? undefined,
    isProcessing: isProcessing$.value,
    modelSettings: modelSettings$.value,
    setModelSettings: setModelSettings$.value ?? undefined,
    requestUndo: requestUndo$.value ?? (() => {}),
    getStateAtEvent:
      getStateAtEvent$.value ??
      (() => {
        throw new Error("getStateAtEvent not initialized");
      }),
    playerStrategies: playerStrategies$.value,
    localPlayerId: localPlayerId$.value,
    isSpectator: isSpectator$.value,
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
