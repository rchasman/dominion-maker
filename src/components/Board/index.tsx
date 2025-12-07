import { useState, useCallback } from "react";
import { useGame } from "../../context/GameContext";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { EventDevtools } from "../EventDevtools";
import { countVP, getAllCards } from "../../lib/board-utils";
import { OpponentBar } from "./OpponentBar";
import { ActionBar } from "./ActionBar";
import { GameSidebar } from "./GameSidebar";
import { GameOverModal } from "./GameOverModal";
import type { CardName } from "../../types/game-state";
import { isActionCard, isTreasureCard } from "../../data/cards";

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

  if (!state) return null;

  // Use preview state when scrubbing, otherwise use live state
  const displayState = previewEventId && getStateAtEvent ? getStateAtEvent(previewEventId) : state;
  const isPreviewMode = previewEventId !== null;

  const isHumanTurn = state.activePlayer === "human";

  // Card click handler
  const onCardClick = useCallback((card: CardName, index: number) => {
    if (!isHumanTurn) return;

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
        console.error("Failed to play action:", result.error);
      }
      return;
    }

    // Buy phase - play treasures
    if (state.phase === "buy" && isTreasureCard(card)) {
      const result = playTreasure(card);
      if (!result.ok) {
        console.error("Failed to play treasure:", result.error);
      }
      return;
    }
  }, [state, selectedCardIndices, playAction, playTreasure]);

  // Handle in-play clicks (unplay treasures)
  const onInPlayClick = useCallback((card: CardName) => {
    if (!isHumanTurn || state.phase !== "buy") return;

    const result = unplayTreasure(card);
    if (!result.ok) {
      console.error("Failed to unplay treasure:", result.error);
    }
  }, [state?.phase, unplayTreasure, isHumanTurn]);

  const canBuy = isHumanTurn && state.phase === "buy" && state.buys > 0 && !isPreviewMode;
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
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 20rem",
      inlineSize: "100vw",
      blockSize: "100dvh",
      overflow: "hidden",
      background: "var(--color-bg-primary)",
      position: "relative"
    }}>
      {/* Preview mode indicator */}
      {isPreviewMode && (
        <div style={{
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
        }}>
          ⏸ PREVIEW MODE - Scrubbing through history
        </div>
      )}

      {/* Main game area */}
      <div style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto auto",
        rowGap: "var(--space-3)",
        padding: "var(--space-5)",
        minInlineSize: 0,
        overflow: "hidden",
        paddingTop: isPreviewMode ? "calc(var(--space-5) + 2.5rem)" : "var(--space-5)",
      }}>
        <OpponentBar
          opponent={opponent}
          opponentId="ai"
          isHumanTurn={isHumanTurn}
          gameMode={gameMode}
          onGameModeChange={onGameModeChange}
          phase={displayState.phase}
          subPhase={displayState.subPhase}
        />

        <div style={{ minBlockSize: 0, display: "flex", flexDirection: "column" }}>
          <Supply
            state={displayState}
            onBuyCard={isPreviewMode ? undefined : onBuyCard}
            canBuy={isPreviewMode ? () => false : canBuy}
            availableCoins={displayState.coins}
            pendingDecision={displayState.pendingDecision}
          />
        </div>

        {isHumanTurn && !state.pendingDecision && !isPreviewMode && (
          <ActionBar
            state={displayState}
            hint={getHint()}
            hasTreasuresInHand={hasTreasuresInHand}
            onPlayAllTreasures={onPlayAllTreasures}
            onEndPhase={onEndPhase}
          />
        )}

        {/* Decision panel */}
        {state.pendingDecision && state.pendingDecision.player === "human" && (
          <div style={{
            padding: "var(--space-4)",
            background: "rgba(99, 102, 241, 0.1)",
            borderRadius: "8px",
            border: "1px solid rgba(99, 102, 241, 0.3)",
          }}>
            <div style={{
              color: "var(--color-text-primary)",
              fontWeight: 600,
              marginBottom: "var(--space-2)",
            }}>
              {state.pendingDecision.prompt}
            </div>
            <div style={{
              color: "var(--color-text-secondary)",
              fontSize: "0.875rem",
              marginBottom: "var(--space-3)",
            }}>
              Selected: {selectedCardIndices.length > 0 ? selectedCardIndices.map(i => human.hand[i]).join(", ") : "(none)"}
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                onClick={() => {
                  const selectedCards = selectedCardIndices.map(i => human.hand[i]);
                  const result = submitDecision({ selectedCards });
                  if (result.ok) {
                    setSelectedCardIndices([]);
                  }
                }}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  background: "rgba(99, 102, 241, 0.8)",
                  border: "none",
                  borderRadius: "6px",
                  color: "white",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
                disabled={selectedCardIndices.length < state.pendingDecision.min}
              >
                Confirm
              </button>
              {state.pendingDecision.min === 0 && (
                <button
                  onClick={() => {
                    const result = submitDecision({ selectedCards: [] });
                    if (result.ok) {
                      setSelectedCardIndices([]);
                    }
                  }}
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    background: "var(--color-bg-tertiary)",
                    border: "1px solid var(--color-border-primary)",
                    borderRadius: "6px",
                    color: "var(--color-text-primary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: "0.875rem",
                  }}
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        )}

        <PlayerArea
          player={human}
          label="You"
          vpCount={humanVP}
          isActive={isHumanTurn}
          isHuman={true}
          selectedCardIndices={isPreviewMode ? [] : selectedCardIndices}
          onCardClick={isPreviewMode ? undefined : onCardClick}
          onInPlayClick={!isPreviewMode && displayState.phase === "buy" ? onInPlayClick : undefined}
          pendingDecision={displayState.pendingDecision}
          phase={displayState.phase}
          subPhase={displayState.subPhase}
        />
      </div>

      <GameSidebar
        state={displayState}
        events={events}
        isProcessing={isProcessing}
        gameMode={gameMode}
        localPlayer="human"
        modelSettings={modelSettings}
        onModelSettingsChange={onModelSettingsChange}
        onNewGame={onNewGame}
        onBackToHome={onBackToHome}
        onRequestUndo={requestUndo}
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
        currentState={state}
        isOpen={showDevtools}
        onToggle={() => setShowDevtools(!showDevtools)}
        onBranchFrom={(eventId) => {
          requestUndo(eventId, "Branch from event timeline");
        }}
        onScrub={(eventId) => {
          setPreviewEventId(eventId);
        }}
      />
    </div>
  );
}
