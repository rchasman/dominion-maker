import { lazy, Suspense } from "preact/compat";
import { useCallback } from "preact/hooks";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { formatPlayerName } from "../../lib/board-utils";
import { useGame } from "../../context/hooks";
import { GameSidebar } from "./GameSidebar";
import { GameOverModal } from "./GameOverModal";
import type { CardName, GameState } from "../../types/game-state";
import type { GameEvent, PlayerId } from "../../events/types";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import type { PlayerStrategyData } from "../../types/player-strategy";
import { BoardLayout, GameAreaLayout } from "./BoardLayout";
import { MainPlayerArea } from "./MainPlayerArea";
import type { BoardState } from "./boardStateHelpers";
import type { ComplexDecisionData } from "./hooks";
import { useAnimationSafe } from "../../animation";

const EventDevtools = lazy(() =>
  import("../EventDevtools").then(m => ({ default: m.EventDevtools })),
);

interface BoardContentProps {
  boardState: BoardState;
  game: {
    events: GameEvent[];
    isProcessing: boolean;
    gameMode: GameMode;
    setGameMode?: (mode: GameMode) => void;
    modelSettings: ModelSettings;
    setModelSettings: (settings: ModelSettings) => void;
    playerStrategies: PlayerStrategyData;
    buyCard: (card: CardName) => void;
    playAllTreasures: () => void;
    endPhase: () => void;
    hasTreasuresInHand: boolean;
    gameOver: boolean;
    winner: string | undefined;
  };
  isPreviewMode: boolean;
  selectedCardIndices: number[];
  complexDecisionData: ComplexDecisionData | null;
  showDevtools: boolean;
  onToggleDevtools: () => void;
  onNewGame: () => void;
  onBackToHome?: () => void;
  onRequestUndo: (eventId: string) => void;
  onScrub: (eventId: string) => void;
  onCardClick?: (card: CardName, index: number) => void;
  onInPlayClick?: (card: CardName) => void;
  onPlayAllTreasures?: () => void;
  onEndPhase?: () => void;
  onConfirmDecision?: (data: ComplexDecisionData | null) => void;
  onSkipDecision?: () => void;
  onComplexDecisionChange: (data: ComplexDecisionData) => void;
}

interface SupplyAreaProps {
  displayState: GameState;
  onBuyCard?: (card: CardName) => void;
  canBuy: boolean;
  isPlayerActive: boolean;
  hasTreasuresInHand: boolean;
  onPlayAllTreasures?: () => void;
  onEndPhase?: () => void;
  selectedCardIndices: number[];
  onConfirmDecision?: (data: ComplexDecisionData | null) => void;
  onSkipDecision?: () => void;
  complexDecisionData: ComplexDecisionData | null;
}

function SupplyArea({
  displayState,
  onBuyCard,
  canBuy,
  isPlayerActive,
  hasTreasuresInHand,
  onPlayAllTreasures,
  onEndPhase,
  selectedCardIndices,
  onConfirmDecision,
  onSkipDecision,
  complexDecisionData,
}: SupplyAreaProps) {
  return (
    <Supply
      state={displayState}
      onBuyCard={onBuyCard}
      canBuy={canBuy}
      availableCoins={displayState.coins}
      pendingDecision={displayState.pendingDecision}
      isPlayerActive={isPlayerActive}
      hasTreasuresInHand={hasTreasuresInHand}
      onPlayAllTreasures={onPlayAllTreasures}
      onEndPhase={onEndPhase}
      selectedCardIndices={selectedCardIndices}
      onConfirmDecision={onConfirmDecision}
      onSkipDecision={onSkipDecision}
      complexDecisionData={complexDecisionData}
    />
  );
}

export function BoardContent({
  boardState,
  game,
  isPreviewMode,
  selectedCardIndices,
  complexDecisionData,
  showDevtools,
  onToggleDevtools,
  onNewGame,
  onBackToHome,
  onRequestUndo,
  onScrub,
  onCardClick,
  onInPlayClick,
  onPlayAllTreasures,
  onEndPhase,
  onConfirmDecision,
  onSkipDecision,
  onComplexDecisionChange,
}: BoardContentProps) {
  const {
    displayState,
    mainPlayerId,
    opponentPlayerId,
    isMainPlayerTurn,
    canBuy,
    opponent,
    mainPlayer,
    mainPlayerVP,
    opponentVP,
    isOpponentAI,
    isMainPlayerAI,
  } = boardState;

  const { players } = useGame();
  const animation = useAnimationSafe();

  // Try to get opponent name from players list (multiplayer)
  const opponentPlayerName = players?.find(
    p => p.playerId === opponentPlayerId,
  )?.name;
  const opponentDisplayName = opponentPlayerName
    ? isOpponentAI
      ? `${opponentPlayerName} (AI)`
      : opponentPlayerName
    : formatPlayerName(opponentPlayerId, isOpponentAI, {
        gameState: displayState,
      });

  // Wrap buyCard to add flying animation from supply to discard
  const animatedBuyCard = useCallback(
    (card: CardName) => {
      // Find the supply card element
      const cardElement = document.querySelector(
        `[data-card-id="supply-${card}"]`,
      );
      const fromRect = cardElement?.getBoundingClientRect();

      // Execute the buy
      game.buyCard(card);

      // Queue animation
      if (animation && fromRect) {
        animation.queueAnimation({
          cardName: card,
          fromRect,
          toZone: "discard",
          duration: 300,
        });
      }
    },
    [game, animation],
  );

  // Wrap playAllTreasures to animate all treasures flying to inPlay
  const animatedPlayAllTreasures = useCallback(() => {
    if (!onPlayAllTreasures) return;

    // Find all treasure cards in main player's hand (not opponent's)
    // Main player cards: hand-{index}-{card}, Opponent cards: hand-opponent-{index}-{card}
    const treasureElements = document.querySelectorAll(
      '[data-card-id^="hand-"]:not([data-card-id^="hand-opponent"])',
    );
    const filteredElements = Array.from(treasureElements).filter(el => {
      const cardId = el.getAttribute("data-card-id") ?? "";
      return (
        cardId.includes("Copper") ||
        cardId.includes("Silver") ||
        cardId.includes("Gold")
      );
    });

    const cardRects: Array<{ card: CardName; rect: DOMRect }> = [];
    filteredElements.forEach(el => {
      const cardId = el.getAttribute("data-card-id");
      if (cardId) {
        // Format is hand-{index}-{cardName}, so skip first two parts
        const card = cardId.split("-").slice(2).join("-") as CardName;
        cardRects.push({ card, rect: el.getBoundingClientRect() });
      }
    });

    // Execute the action
    onPlayAllTreasures();

    // Queue animations all at once (no stagger to avoid flash)
    if (animation) {
      cardRects.forEach(({ card, rect }) => {
        animation.queueAnimation({
          cardName: card,
          fromRect: rect,
          toZone: "inPlay",
          duration: 200,
        });
      });
    }
  }, [onPlayAllTreasures, animation]);

  return (
    <BoardLayout isPreviewMode={isPreviewMode}>
      <GameAreaLayout isPreviewMode={isPreviewMode}>
        <PlayerArea
          player={opponent}
          label={opponentDisplayName}
          vpCount={opponentVP}
          isActive={!isMainPlayerTurn}
          showCards={true}
          selectedCardIndices={[]}
          inverted={true}
          phase={displayState.phase}
          subPhase={displayState.subPhase}
          actions={displayState.actions}
          playerId={opponentPlayerId}
          turnHistory={displayState.turnHistory}
          playerStrategy={game.playerStrategies[opponentPlayerId]}
          gameState={displayState}
        />

        <SupplyArea
          displayState={displayState}
          onBuyCard={isPreviewMode ? undefined : animatedBuyCard}
          canBuy={isPreviewMode ? false : canBuy}
          isPlayerActive={isMainPlayerTurn}
          hasTreasuresInHand={game.hasTreasuresInHand}
          onPlayAllTreasures={animatedPlayAllTreasures}
          onEndPhase={onEndPhase}
          selectedCardIndices={selectedCardIndices}
          onConfirmDecision={onConfirmDecision}
          onSkipDecision={onSkipDecision}
          complexDecisionData={complexDecisionData}
        />

        <MainPlayerArea
          mainPlayer={mainPlayer}
          mainPlayerId={mainPlayerId}
          mainPlayerVP={mainPlayerVP}
          isMainPlayerTurn={isMainPlayerTurn}
          isMainPlayerAI={isMainPlayerAI}
          selectedCardIndices={selectedCardIndices}
          isPreviewMode={isPreviewMode}
          displayState={displayState}
          playerStrategy={game.playerStrategies[mainPlayerId]}
          onCardClick={onCardClick}
          onInPlayClick={onInPlayClick}
          onComplexDecisionChange={onComplexDecisionChange}
          formatPlayerName={formatPlayerName}
        />
      </GameAreaLayout>

      <GameSidebar
        state={displayState}
        events={game.events}
        isProcessing={game.isProcessing}
        gameMode={game.gameMode}
        onGameModeChange={game.setGameMode}
        localPlayer={mainPlayerId}
        modelSettings={game.modelSettings}
        onModelSettingsChange={game.setModelSettings}
        onNewGame={onNewGame}
        onBackToHome={onBackToHome}
        onRequestUndo={onRequestUndo}
      />

      {game.gameOver && game.winner && (
        <GameOverModal
          winner={game.winner}
          mainPlayerId={mainPlayerId as PlayerId}
          opponentPlayerId={opponentPlayerId as PlayerId}
          isMainPlayerAI={isMainPlayerAI}
          isOpponentAI={isOpponentAI}
          mainPlayerVP={mainPlayerVP}
          opponentVP={opponentVP}
          turnCount={displayState.turn}
          gameState={displayState}
          onNewGame={onNewGame}
        />
      )}

      <Suspense fallback={null}>
        <EventDevtools
          events={game.events}
          isOpen={showDevtools}
          onToggle={onToggleDevtools}
          onBranchFrom={onRequestUndo}
          onScrub={onScrub}
        />
      </Suspense>
    </BoardLayout>
  );
}
