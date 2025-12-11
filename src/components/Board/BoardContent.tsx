import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { EventDevtools } from "../EventDevtools";
import { formatPlayerName } from "../../lib/board-utils";
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

interface BoardContentProps {
  boardState: BoardState;
  game: {
    events: GameEvent[];
    isProcessing: boolean;
    gameMode: GameMode;
    setGameMode: (mode: GameMode) => void;
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
    hint,
    isOpponentAI,
    isMainPlayerAI,
  } = boardState;

  return (
    <BoardLayout isPreviewMode={isPreviewMode}>
      <GameAreaLayout isPreviewMode={isPreviewMode}>
        <PlayerArea
          player={opponent}
          label={formatPlayerName(opponentPlayerId, isOpponentAI)}
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
          playerStrategy={game.playerStrategies.find(s => s.id === opponentPlayerId)}
          gameState={displayState}
        />

        <SupplyArea
          displayState={displayState}
          onBuyCard={isPreviewMode ? undefined : game.buyCard}
          canBuy={isPreviewMode ? false : canBuy}
          isPlayerActive={isMainPlayerTurn}
          hasTreasuresInHand={game.hasTreasuresInHand}
          onPlayAllTreasures={onPlayAllTreasures}
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
          hint={hint}
          hasTreasuresInHand={game.hasTreasuresInHand}
          complexDecisionData={complexDecisionData}
          playerStrategy={game.playerStrategies.find(s => s.id === mainPlayerId)}
          onCardClick={onCardClick}
          onInPlayClick={onInPlayClick}
          onPlayAllTreasures={onPlayAllTreasures}
          onEndPhase={onEndPhase}
          onConfirmDecision={onConfirmDecision}
          onSkipDecision={onSkipDecision}
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
          onNewGame={onNewGame}
        />
      )}

      <EventDevtools
        events={game.events}
        isOpen={showDevtools}
        onToggle={onToggleDevtools}
        onBranchFrom={onRequestUndo}
        onScrub={onScrub}
      />
    </BoardLayout>
  );
}
