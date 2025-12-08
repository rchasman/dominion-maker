import { useState, useCallback, useEffect } from "react";
import { useGame } from "../../context/GameContext";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { EventDevtools } from "../EventDevtools";
import { CardDecisionModal } from "../CardDecisionModal";
import { countVP, getAllCards } from "../../lib/board-utils";
import { OpponentBar } from "./OpponentBar";
import { ActionBar } from "./ActionBar";
import { GameSidebar } from "./GameSidebar";
import { GameOverModal } from "./GameOverModal";
import type { CardName } from "../../types/game-state";
import { isActionCard, isTreasureCard } from "../../data/cards";
import { uiLogger } from "../../lib/logger";

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
    startGame: onNewGame,
    isProcessing,
    modelSettings,
    setModelSettings: onModelSettingsChange,
    requestUndo,
    getStateAtEvent,
  } = useGame();

  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [showDevtools, setShowDevtools] = useState(false);
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);
  const [complexDecisionData, setComplexDecisionData] = useState<{
    cardActions: Record<number, string>;
    cardOrder?: number[];
  } | null>(null);

  // Wrap requestUndo to clear preview state and selections when undoing
  const handleRequestUndo = useCallback(
    (eventId: string) => {
      setPreviewEventId(null); // Clear preview when undoing
      setSelectedCardIndices([]); // Clear selected cards when undoing
      requestUndo(eventId);
    },
    [requestUndo],
  );

  // Clear UI state when a new game starts (detected by GAME_INITIALIZED event)
  useEffect(() => {
    const hasGameInit = events.some(e => e.type === "GAME_INITIALIZED");
    const isNewGame = hasGameInit && events.length < 10; // New game has few events

    // Reset UI state at start of new game
    if (isNewGame) {
      // Use a microtask to avoid synchronous setState in effect
      queueMicrotask(() => {
        setPreviewEventId(null);
        setSelectedCardIndices([]);
      });
    }
  }, [events.length]);

  // Card click handler - must be defined before early return
  const onCardClick = useCallback(
    (card: CardName, index: number) => {
      if (!state?.activePlayer || state.activePlayer !== "human") return;

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
    },
    [state, selectedCardIndices, playAction, playTreasure],
  );

  // Handle in-play clicks (unplay treasures)
  const onInPlayClick = useCallback(
    (card: CardName) => {
      if (!state || state.activePlayer !== "human" || state.phase !== "buy")
        return;

      const result = unplayTreasure(card);
      if (!result.ok) {
        uiLogger.error("Failed to unplay treasure:", result.error);
      }
    },
    [state, unplayTreasure],
  );

  if (!state) return null;

  // Use preview state when scrubbing, otherwise use live state
  const displayState =
    previewEventId && getStateAtEvent ? getStateAtEvent(previewEventId) : state;
  const isPreviewMode = previewEventId !== null;

  const isHumanTurn = state.activePlayer === "human";

  const canBuy =
    isHumanTurn && state.phase === "buy" && state.buys > 0 && !isPreviewMode;
  const opponent = displayState.players.ai;
  const human = displayState.players.human;
  const humanVP = countVP(getAllCards(human));
  const opponentVP = countVP(getAllCards(opponent));

  const getHint = () => {
    if (state.pendingDecision && state.pendingDecision.player === "human") {
      return state.pendingDecision.prompt;
    }
    if (!isHumanTurn) return "Opponent is playing...";
    if (state.phase === "action") {
      if (hasPlayableActions) return "Click an Action card to play it";
      return "";
    }
    if (state.phase === "buy") {
      const hasInPlayTreasures = human.inPlay.length > 0;
      if (state.coins === 0 && hasTreasuresInHand) {
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
          gridTemplateRows: "auto 1fr auto auto",
          rowGap: "var(--space-3)",
          padding: "var(--space-5)",
          minInlineSize: 0,
          overflow: "hidden",
          paddingTop: isPreviewMode
            ? "calc(var(--space-5) + 2.5rem)"
            : "var(--space-5)",
          position: "relative",
        }}
      >
        <OpponentBar
          opponent={opponent}
          opponentId="ai"
          isHumanTurn={isHumanTurn}
          phase={displayState.phase}
          subPhase={displayState.subPhase}
        />

        <div
          style={{ minBlockSize: 0, display: "flex", flexDirection: "column" }}
        >
          <Supply
            state={displayState}
            onBuyCard={isPreviewMode ? undefined : onBuyCard}
            canBuy={isPreviewMode ? false : canBuy}
            availableCoins={displayState.coins}
            pendingDecision={displayState.pendingDecision}
          />
        </div>

        {isHumanTurn && !isPreviewMode && (
          <ActionBar
            state={displayState}
            hint={getHint()}
            hasTreasuresInHand={hasTreasuresInHand}
            onPlayAllTreasures={onPlayAllTreasures}
            onEndPhase={onEndPhase}
            selectedCardIndices={selectedCardIndices}
            complexDecisionData={complexDecisionData}
            onConfirmDecision={data => {
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
                  i => human.hand[i],
                );
                const result = submitDecision({ selectedCards });
                if (result.ok) {
                  setSelectedCardIndices([]);
                }
              }
            }}
            onSkipDecision={() => {
              const result = submitDecision({ selectedCards: [] });
              if (result.ok) {
                setSelectedCardIndices([]);
              }
            }}
          />
        )}

        <div style={{ position: "relative" }}>
          <PlayerArea
            player={human}
            label="You"
            vpCount={humanVP}
            isActive={isHumanTurn}
            isHuman={true}
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
            playerId="human"
            turnHistory={displayState.turnHistory}
          />

          {/* Card Decision Overlay */}
          {displayState.pendingDecision &&
            displayState.pendingDecision.actions &&
            !isPreviewMode && (
              <CardDecisionModal
                cards={displayState.pendingDecision.cardOptions}
                actions={displayState.pendingDecision.actions}
                requiresOrdering={displayState.pendingDecision.requiresOrdering}
                onDataChange={data => {
                  setComplexDecisionData(data);
                }}
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
        localPlayer="human"
        modelSettings={modelSettings}
        onModelSettingsChange={onModelSettingsChange}
        onNewGame={onNewGame}
        onBackToHome={onBackToHome}
        onRequestUndo={handleRequestUndo}
      />

      {state.gameOver && (
        <GameOverModal
          winner={state.winner}
          humanVP={humanVP}
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
