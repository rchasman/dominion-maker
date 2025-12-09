import { useState, useCallback } from "react";
import { useGame } from "../../context/hooks";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { EventDevtools } from "../EventDevtools";
import { CardDecisionModal } from "../CardDecisionModal";
import { countVP, getAllCards, formatPlayerName } from "../../lib/board-utils";
import { ActionBar } from "./ActionBar";
import { GameSidebar } from "./GameSidebar";
import { GameOverModal } from "./GameOverModal";
import type { CardName, PlayerId } from "../../types/game-state";
import { isActionCard, isTreasureCard } from "../../data/cards";
import { uiLogger } from "../../lib/logger";
import { getPlayersForMode, GAME_MODE_CONFIG } from "../../types/game-mode";

interface BoardProps {
  onBackToHome?: () => void;
}

export function Board({ onBackToHome }: BoardProps) {
  const {
    gameState: state,
    events,
    playAction,
    playTreasure,
    unplayTreasure,
    buyCard: onBuyCard,
    endPhase: onEndPhase,
    playAllTreasures: onPlayAllTreasures,
    submitDecision,
    hasPlayableActions,
    hasTreasuresInHand,
    gameMode,
    setGameMode: onGameModeChange,
    startGame: startGameFromContext,
    isProcessing,
    modelSettings,
    setModelSettings: onModelSettingsChange,
    requestUndo,
    getStateAtEvent,
    playerStrategies,
  } = useGame();

  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [showDevtools, setShowDevtools] = useState(false);
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);

  // Wrap startGame to clear UI state on new game
  const onNewGame = useCallback(() => {
    // Clear UI state before starting new game
    setPreviewEventId(null);
    setSelectedCardIndices([]);
    startGameFromContext();
  }, [startGameFromContext]);
  const [complexDecisionData, setComplexDecisionData] = useState<{
    cardActions: Record<number, string>;
    cardOrder?: number[];
  } | null>(null);

  const handleComplexDecisionDataChange = useCallback(
    (data: { cardActions: Record<number, string>; cardOrder?: number[] }) => {
      setComplexDecisionData(data);
    },
    [],
  );

  // Determine player IDs - use actual from state if available, otherwise defaults
  const getPlayerIds = (): PlayerId[] => {
    if (state) return Object.keys(state.players) as PlayerId[];
    if (gameMode === "multiplayer") return ["human", "ai"] as PlayerId[];
    return getPlayersForMode(gameMode);
  };

  const playerIds = getPlayerIds();
  const mainPlayerId = playerIds[0];

  // Wrap requestUndo to clear preview state and selections when undoing
  const handleRequestUndo = useCallback(
    (eventId: string) => {
      setPreviewEventId(null); // Clear preview when undoing
      setSelectedCardIndices([]); // Clear selected cards when undoing
      requestUndo(eventId);
    },
    [requestUndo],
  );

  // Card click handler - must be defined before early return
  const onCardClick = (card: CardName, index: number) => {
    if (!state?.activePlayer || state.activePlayer !== mainPlayerId) return;

    // If we have a pending decision, add to selection
    if (state.pendingDecision) {
      const decision = state.pendingDecision;
      const max = decision.max || 1;

      if (selectedCardIndices.includes(index)) {
        setSelectedCardIndices(prev => prev.filter(i => i !== index));
      } else if (selectedCardIndices.length < max) {
        setSelectedCardIndices(prev => [...prev, index]);
      }
      return;
    }

    // Action phase - play action cards
    if (state.phase === "action" && isActionCard(card) && state.actions > 0) {
      const result = playAction(card);
      if (!result.ok) {
        uiLogger.error("Failed to play action:", result.error);
      }
      return;
    }

    // Buy phase - play treasures
    if (state.phase === "buy" && isTreasureCard(card)) {
      const result = playTreasure(card);
      if (!result.ok) {
        uiLogger.error("Failed to play treasure:", result.error);
      }
      return;
    }
  };

  // Handle in-play clicks (unplay treasures)
  const onInPlayClick = (card: CardName) => {
    if (!state || state.activePlayer !== mainPlayerId || state.phase !== "buy")
      return;

    const result = unplayTreasure(card);
    if (!result.ok) {
      uiLogger.error("Failed to unplay treasure:", result.error);
    }
  };

  if (!state) return null;

  // Use preview state when scrubbing, otherwise use live state
  const displayState =
    previewEventId && getStateAtEvent ? getStateAtEvent(previewEventId) : state;
  const isPreviewMode = previewEventId !== null;

  // Second player is the "opponent" view
  const opponentPlayerId = playerIds[1];

  const isMainPlayerTurn = displayState.activePlayer === mainPlayerId;

  const canBuy =
    isMainPlayerTurn &&
    displayState.phase === "buy" &&
    displayState.buys > 0 &&
    !isPreviewMode;
  const opponent = displayState.players[opponentPlayerId];
  const mainPlayer = displayState.players[mainPlayerId];
  const mainPlayerVP = countVP(getAllCards(mainPlayer));
  const opponentVP = countVP(getAllCards(opponent));

  const getHint = () => {
    if (
      displayState.pendingDecision &&
      displayState.pendingDecision.player === mainPlayerId
    ) {
      return displayState.pendingDecision.prompt;
    }
    if (!isMainPlayerTurn) return "Opponent is playing...";
    if (displayState.phase === "action") {
      if (hasPlayableActions) return "Click an Action card to play it";
      return "";
    }
    if (displayState.phase === "buy") {
      const hasInPlayTreasures = mainPlayer.inPlay.length > 0;
      if (displayState.coins === 0 && hasTreasuresInHand) {
        return "Play treasures to get coins";
      }
      if (hasInPlayTreasures) {
        return "Click played treasures to take back";
      }
      return "";
    }
    return "";
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 20rem",
        inlineSize: "100vw",
        blockSize: "100dvh",
        overflow: "hidden",
        background: "var(--color-bg-primary)",
        position: "relative",
      }}
    >
      {/* Preview mode indicator */}
      {isPreviewMode && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            background: "rgba(99, 102, 241, 0.9)",
            color: "white",
            padding: "var(--space-3)",
            textAlign: "center",
            fontWeight: 600,
            fontSize: "0.875rem",
            zIndex: 1000,
            borderBottom: "2px solid #6366f1",
          }}
        >
          ⏸ PREVIEW MODE - Scrubbing through history
        </div>
      )}

      {/* Main game area */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          rowGap: "var(--space-2)",
          padding: "var(--space-3)",
          minInlineSize: 0,
          overflow: "hidden",
          paddingTop: isPreviewMode
            ? "calc(var(--space-3) + 2.5rem)"
            : "var(--space-3)",
          position: "relative",
        }}
      >
        <PlayerArea
          player={opponent}
          label={formatPlayerName(
            opponentPlayerId,
            gameMode !== "multiplayer" &&
              GAME_MODE_CONFIG[gameMode].isAIPlayer(opponentPlayerId),
          )}
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
          playerStrategy={playerStrategies[opponentPlayerId]}
          gameState={displayState}
          actionBarHint={
            displayState.pendingDecision?.player === opponentPlayerId
              ? displayState.pendingDecision.prompt
              : ""
          }
          hasTreasuresInHand={false}
        />

        <Supply
          state={displayState}
          onBuyCard={isPreviewMode ? undefined : onBuyCard}
          canBuy={isPreviewMode ? false : canBuy}
          availableCoins={displayState.coins}
          pendingDecision={displayState.pendingDecision}
        />

        <div style={{ position: "relative" }}>
          <PlayerArea
            player={mainPlayer}
            label={formatPlayerName(
              mainPlayerId,
              gameMode !== "multiplayer" &&
                GAME_MODE_CONFIG[gameMode].isAIPlayer(mainPlayerId),
            )}
            vpCount={mainPlayerVP}
            isActive={isMainPlayerTurn}
            showCards={true}
            selectedCardIndices={isPreviewMode ? [] : selectedCardIndices}
            onCardClick={isPreviewMode ? undefined : onCardClick}
            onInPlayClick={
              !isPreviewMode && displayState.phase === "buy"
                ? onInPlayClick
                : undefined
            }
            pendingDecision={displayState.pendingDecision}
            phase={displayState.phase}
            subPhase={displayState.subPhase}
            actions={displayState.actions}
            playerId={mainPlayerId}
            turnHistory={displayState.turnHistory}
            playerStrategy={playerStrategies[mainPlayerId]}
            gameState={displayState}
            actionBarHint={getHint()}
            hasTreasuresInHand={hasTreasuresInHand}
            onPlayAllTreasures={
              isMainPlayerTurn && !isPreviewMode
                ? onPlayAllTreasures
                : undefined
            }
            onEndPhase={
              isMainPlayerTurn && !isPreviewMode ? onEndPhase : undefined
            }
            complexDecisionData={complexDecisionData}
            onConfirmDecision={
              isMainPlayerTurn && !isPreviewMode
                ? data => {
                    if (data) {
                      // Complex decision with cardActions and cardOrder
                      const result = submitDecision({
                        selectedCards: [],
                        cardActions: data.cardActions,
                        cardOrder: data.cardOrder,
                      });
                      if (result.ok) {
                        setSelectedCardIndices([]);
                        setComplexDecisionData(null);
                      }
                    } else {
                      // Simple card selection
                      const selectedCards = selectedCardIndices.map(
                        i => mainPlayer.hand[i],
                      );
                      const result = submitDecision({ selectedCards });
                      if (result.ok) {
                        setSelectedCardIndices([]);
                      }
                    }
                  }
                : undefined
            }
            onSkipDecision={
              isMainPlayerTurn && !isPreviewMode
                ? () => {
                    const result = submitDecision({ selectedCards: [] });
                    if (result.ok) {
                      setSelectedCardIndices([]);
                    }
                  }
                : undefined
            }
          />

          {/* Card Decision Overlay */}
          {displayState.pendingDecision &&
            displayState.pendingDecision.actions &&
            !isPreviewMode && (
              <CardDecisionModal
                cards={displayState.pendingDecision.cardOptions}
                actions={displayState.pendingDecision.actions}
                requiresOrdering={displayState.pendingDecision.requiresOrdering}
                onDataChange={handleComplexDecisionDataChange}
              />
            )}
        </div>
      </div>

      <GameSidebar
        state={displayState}
        events={events}
        isProcessing={isProcessing}
        gameMode={gameMode}
        onGameModeChange={onGameModeChange}
        localPlayer={mainPlayerId}
        modelSettings={modelSettings}
        onModelSettingsChange={onModelSettingsChange}
        onNewGame={onNewGame}
        onBackToHome={onBackToHome}
        onRequestUndo={handleRequestUndo}
      />

      {state.gameOver && (
        <GameOverModal
          winner={state.winner}
          mainPlayerId={mainPlayerId}
          mainPlayerVP={mainPlayerVP}
          opponentVP={opponentVP}
          onNewGame={onNewGame}
        />
      )}

      {/* Event Devtools */}
      <EventDevtools
        events={events}
        isOpen={showDevtools}
        onToggle={() => setShowDevtools(!showDevtools)}
        onBranchFrom={handleRequestUndo}
        onScrub={eventId => {
          setPreviewEventId(eventId);
        }}
      />
    </div>
  );
}
