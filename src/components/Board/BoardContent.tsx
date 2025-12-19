import { lazy, Suspense } from "preact/compat";
import { useCallback } from "preact/hooks";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { formatPlayerName } from "../../lib/board-utils";
import { useGame } from "../../context/hooks";
import { GameSidebar } from "./GameSidebar";
import { GameOverModal } from "./GameOverModal";
import { UndoRequestModal } from "./UndoRequestModal";
import type { CardName, GameState, PlayerId } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { GameMode } from "../../types/game-mode";
import type { ModelSettings } from "../../agent/game-agent";
import type { PlayerStrategyData } from "../../types/player-strategy";
import { BoardLayout, GameAreaLayout } from "./BoardLayout";
import { MainPlayerArea } from "./MainPlayerArea";
import type { BoardState } from "./boardStateHelpers";
import type { ComplexDecisionData } from "./hooks";
import { useAnimationSafe } from "../../animation";
import { run } from "../../lib/run";

const ANIMATION_DURATION = {
  BUY_TO_DISCARD_MS: 300,
  PLAY_TREASURE_MS: 200,
} as const;

const CARD_ID_SKIP_PARTS = 2;

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
    winnerId: PlayerId | undefined;
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
  onRevealReaction?: (card: CardName) => void;
  onDeclineReaction?: () => void;
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
      pendingChoice={displayState.pendingChoice}
      isPlayerActive={isPlayerActive}
      hasTreasuresInHand={hasTreasuresInHand}
      onPlayAllTreasures={onPlayAllTreasures}
      {...(onEndPhase !== undefined && { onEndPhase })}
      selectedCardIndices={selectedCardIndices}
      {...(onConfirmDecision !== undefined && { onConfirmDecision })}
      {...(onSkipDecision !== undefined && { onSkipDecision })}
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
  onRevealReaction,
  onDeclineReaction,
  onComplexDecisionChange,
}: BoardContentProps) {
  const {
    displayState,
    localPlayerId,
    opponentPlayerId,
    isLocalPlayerTurn,
    canBuy,
    opponent,
    localPlayer,
    localPlayerVP,
    opponentVP,
    isOpponentAI,
    isLocalPlayerAI,
  } = boardState;

  const { players, pendingUndo, approveUndo, denyUndo, localPlayerId: contextLocalPlayerId } = useGame();
  const animation = useAnimationSafe();

  // Try to get opponent name from players list (multiplayer)
  const opponentPlayerName = players?.find(
    p => p.id === opponentPlayerId,
  )?.name;
  const opponentDisplayName = run(() => {
    if (opponentPlayerName) {
      return isOpponentAI ? `${opponentPlayerName} (AI)` : opponentPlayerName;
    }
    return formatPlayerName(opponentPlayerId, isOpponentAI, {
      gameState: displayState,
    });
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
          duration: ANIMATION_DURATION.BUY_TO_DISCARD_MS,
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

    const cardRects = filteredElements
      .map(el => {
        const cardId = el.getAttribute("data-card-id");
        if (!cardId) return null;
        // Format is hand-{index}-{cardName}, so skip first two parts
        const card = cardId
          .split("-")
          .slice(CARD_ID_SKIP_PARTS)
          .join("-") as CardName;
        return { card, rect: el.getBoundingClientRect() };
      })
      .filter(
        (item): item is { card: CardName; rect: DOMRect } => item !== null,
      );

    // Execute the action
    onPlayAllTreasures();

    // Queue animations all at once (no stagger to avoid flash)
    if (animation) {
      cardRects.map(({ card, rect }) =>
        animation.queueAnimation({
          cardName: card,
          fromRect: rect,
          toZone: "inPlay",
          duration: ANIMATION_DURATION.PLAY_TREASURE_MS,
        }),
      );
    }
  }, [onPlayAllTreasures, animation]);

  return (
    <BoardLayout isPreviewMode={isPreviewMode}>
      <GameAreaLayout isPreviewMode={isPreviewMode}>
        <PlayerArea
          player={opponent}
          label={opponentDisplayName}
          vpCount={opponentVP}
          isActive={!isLocalPlayerTurn}
          showCards={true}
          selectedCardIndices={[]}
          inverted={true}
          phase={displayState.phase}
          actions={displayState.actions}
          playerId={opponentPlayerId}
          turnHistory={displayState.turnHistory}
          {...(game.playerStrategies[opponentPlayerId] !== undefined && {
            playerStrategy: game.playerStrategies[opponentPlayerId],
          })}
          gameState={displayState}
        />

        <SupplyArea
          displayState={displayState}
          {...(!isPreviewMode &&
            animatedBuyCard !== undefined && { onBuyCard: animatedBuyCard })}
          canBuy={isPreviewMode ? false : canBuy}
          isPlayerActive={isLocalPlayerTurn}
          hasTreasuresInHand={game.hasTreasuresInHand}
          onPlayAllTreasures={animatedPlayAllTreasures}
          {...(onEndPhase !== undefined && { onEndPhase })}
          selectedCardIndices={selectedCardIndices}
          {...(onConfirmDecision !== undefined && { onConfirmDecision })}
          {...(onSkipDecision !== undefined && { onSkipDecision })}
          complexDecisionData={complexDecisionData}
        />

        <MainPlayerArea
          localPlayer={localPlayer}
          localPlayerVP={localPlayerVP}
          isLocalPlayerTurn={isLocalPlayerTurn}
          isLocalPlayerAI={isLocalPlayerAI}
          selectedCardIndices={selectedCardIndices}
          isPreviewMode={isPreviewMode}
          displayState={displayState}
          {...(onCardClick !== undefined && { onCardClick })}
          {...(onInPlayClick !== undefined && { onInPlayClick })}
          onComplexDecisionChange={onComplexDecisionChange}
          {...(onRevealReaction !== undefined && { onRevealReaction })}
          {...(onDeclineReaction !== undefined && { onDeclineReaction })}
        />
      </GameAreaLayout>

      <GameSidebar
        state={displayState}
        events={game.events}
        isProcessing={game.isProcessing}
        gameMode={game.gameMode}
        {...(game.setGameMode !== undefined && {
          onGameModeChange: game.setGameMode,
        })}
        localPlayer={localPlayerId}
        modelSettings={game.modelSettings}
        onModelSettingsChange={game.setModelSettings}
        {...(onNewGame !== undefined && { onNewGame })}
        {...(onBackToHome !== undefined && { onBackToHome })}
        onRequestUndo={onRequestUndo}
      />

      {game.gameOver && game.winnerId && (
        <GameOverModal
          winnerId={game.winnerId}
          localPlayerId={localPlayerId}
          opponentPlayerId={opponentPlayerId}
          isLocalPlayerAI={isLocalPlayerAI}
          isOpponentAI={isOpponentAI}
          localPlayerVP={localPlayerVP}
          opponentVP={opponentVP}
          turnCount={displayState.turn}
          gameState={displayState}
          onNewGame={onNewGame}
        />
      )}

      {pendingUndo &&
        approveUndo &&
        denyUndo &&
        !game.gameOver &&
        contextLocalPlayerId !== pendingUndo.byPlayer && (
          <UndoRequestModal
            requestId={pendingUndo.requestId}
            byPlayer={pendingUndo.byPlayer}
            byPlayerName={
              players?.find(p => p.id === pendingUndo.byPlayer)?.name ||
              pendingUndo.byPlayer
            }
            toEventId={pendingUndo.toEventId}
            events={game.events}
            onApprove={useCallback(
              (id: string) => {
                if (approveUndo) approveUndo(id);
              },
              [approveUndo],
            )}
            onDeny={useCallback(
              (id: string) => {
                if (denyUndo) denyUndo(id);
              },
              [denyUndo],
            )}
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
