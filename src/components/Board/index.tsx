import { useState, useCallback } from "react";
import { useGame } from "../../context/GameContext";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
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
    playAction,
    playTreasure,
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
  } = useGame();

  const [selectedCards, setSelectedCards] = useState<CardName[]>([]);

  if (!state) return null;

  const isHumanTurn = state.activePlayer === "human";

  // Card click handler
  const onCardClick = useCallback((card: CardName, _index: number) => {
    if (!isHumanTurn) return;

    // If we have a pending decision, add to selection
    if (state.pendingDecision) {
      const decision = state.pendingDecision;
      const max = decision.max || 1;

      if (selectedCards.includes(card)) {
        setSelectedCards(prev => prev.filter(c => c !== card));
      } else if (selectedCards.length < max) {
        setSelectedCards(prev => [...prev, card]);
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
  }, [state, selectedCards, playAction, playTreasure]);

  // Handle in-play clicks (unplay treasures)
  const onInPlayClick = useCallback((card: CardName, _index: number) => {
    // Unplay treasure - not yet implemented in event system
    // TODO: Add UNPLAY_TREASURE command
  }, []);

  const canBuy = isHumanTurn && state.phase === "buy" && state.buys > 0;
  const opponent = state.players.ai;
  const human = state.players.human;
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
      background: "var(--color-bg-primary)"
    }}>
      {/* Main game area */}
      <div style={{
        display: "grid",
        gridTemplateRows: "auto 1fr auto auto",
        rowGap: "var(--space-3)",
        padding: "var(--space-5)",
        minInlineSize: 0,
        overflow: "hidden"
      }}>
        <OpponentBar
          opponent={opponent}
          isHumanTurn={isHumanTurn}
          gameMode={gameMode}
          onGameModeChange={onGameModeChange}
          phase={state.phase}
          subPhase={state.subPhase}
        />

        <div style={{ minBlockSize: 0, display: "flex", flexDirection: "column" }}>
          <Supply
            state={state}
            onBuyCard={onBuyCard}
            canBuy={canBuy}
            availableCoins={state.coins}
            pendingDecision={state.pendingDecision}
          />
        </div>

        {isHumanTurn && !state.pendingDecision && (
          <ActionBar
            state={state}
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
              Selected: {selectedCards.length > 0 ? selectedCards.join(", ") : "(none)"}
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <button
                onClick={() => {
                  const result = submitDecision({ selectedCards });
                  if (result.ok) {
                    setSelectedCards([]);
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
                disabled={selectedCards.length < state.pendingDecision.min}
              >
                Confirm
              </button>
              {state.pendingDecision.min === 0 && (
                <button
                  onClick={() => {
                    const result = submitDecision({ selectedCards: [] });
                    if (result.ok) {
                      setSelectedCards([]);
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
          selectedCards={selectedCards}
          onCardClick={onCardClick}
          onInPlayClick={state.phase === "buy" ? onInPlayClick : undefined}
          pendingDecision={state.pendingDecision}
          phase={state.phase}
          subPhase={state.subPhase}
        />
      </div>

      <GameSidebar
        state={state}
        isProcessing={isProcessing}
        gameMode={gameMode}
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
    </div>
  );
}
