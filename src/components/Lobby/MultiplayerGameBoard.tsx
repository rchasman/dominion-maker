import { uiLogger } from "../../lib/logger";
/**
 * Multiplayer Game Board
 *
 * Full game board for multiplayer games using the event-driven engine.
 * Provides card interactions, action bar, and game state display.
 */
import { useState, useCallback, useEffect } from "react";
import { useMultiplayer } from "../../context/MultiplayerContext";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { EventDevtools } from "../EventDevtools";
import { GameSidebar } from "../Board/GameSidebar";
import { countVP, getAllCards } from "../../lib/board-utils";
import { isActionCard, isTreasureCard } from "../../data/cards";
import type { CardName } from "../../types/game-state";

interface MultiplayerGameBoardProps {
  onBackToHome: () => void;
}

export function MultiplayerGameBoard({ onBackToHome }: MultiplayerGameBoardProps) {
  const {
    gameState,
    events,
    myGamePlayerId,
    isMyTurn,
    leaveRoom,
    endGame,
    players,
    // Game actions
    playAction,
    playTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
    // Undo / Time travel
    requestUndo,
    getStateAtEvent,
  } = useMultiplayer();

  const [selectedCardIndices, setSelectedCardIndices] = useState<number[]>([]);
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);
  const [showDevtools, setShowDevtools] = useState(false);

  // Wrap requestUndo to clear preview state and selections when undoing
  const handleRequestUndo = useCallback((eventId: string) => {
    setPreviewEventId(null); // Clear preview when undoing
    setSelectedCardIndices([]); // Clear selected cards when undoing
    requestUndo(eventId);
  }, [requestUndo]);

  // Clear UI state when a new game starts (detected by GAME_INITIALIZED event)
  useEffect(() => {
    const hasGameInit = events.some(e => e.type === "GAME_INITIALIZED");
    const isNewGame = hasGameInit && events.length < 10; // New game has few events
    if (isNewGame) {
      queueMicrotask(() => {
        setPreviewEventId(null);
        setSelectedCardIndices([]);
      });
    }
  }, [events.length]);

  // Clear preview if the event no longer exists (after undo)
  useEffect(() => {
    if (previewEventId && !events.find(e => e.id === previewEventId)) {
      uiLogger.debug(`Preview event ${previewEventId} no longer exists, clearing preview`);
      queueMicrotask(() => {
        setPreviewEventId(null);
      });
    }
  }, [previewEventId, events]);

  // Card click handler - must be before early return
  const handleCardClick = useCallback((card: CardName, index: number) => {
    if (previewEventId !== null) return; // No actions in preview mode
    if (!isMyTurn) return;

    const displayState = previewEventId ? getStateAtEvent(previewEventId) : gameState;
    if (!displayState) return;

    // If we have a pending decision, add to selection
    if (displayState.pendingDecision) {
      const decision = displayState.pendingDecision;
      const maxCount = decision.max || 1;

      if (selectedCardIndices.includes(index)) {
        setSelectedCardIndices(prev => prev.filter(i => i !== index));
      } else if (selectedCardIndices.length < maxCount) {
        setSelectedCardIndices(prev => [...prev, index]);
      }
      return;
    }

    // Action phase - play action cards
    if (displayState.phase === "action" && isActionCard(card) && displayState.actions > 0) {
      const result = playAction(card);
      if (!result.ok) {
        uiLogger.error("Failed to play action:", result.error);
      }
      return;
    }

    // Buy phase - play treasures
    if (displayState.phase === "buy" && isTreasureCard(card)) {
      const result = playTreasure(card);
      if (!result.ok) {
        uiLogger.error("Failed to play treasure:", result.error);
      }
      return;
    }
  }, [isMyTurn, gameState, selectedCardIndices, playAction, playTreasure, previewEventId, getStateAtEvent]);

  // Buy card handler
  const handleBuyCard = useCallback((card: CardName) => {
    if (previewEventId !== null) return;
    const displayState = previewEventId ? getStateAtEvent(previewEventId) : gameState;
    if (!displayState) return;
    const canBuy = isMyTurn && displayState.phase === "buy" && displayState.buys > 0 && !previewEventId;
    if (!canBuy) return;

    const result = buyCard(card);
    if (!result.ok) {
      uiLogger.error("Failed to buy card:", result.error);
    }
  }, [isMyTurn, gameState, buyCard, previewEventId, getStateAtEvent]);

  // End phase handler
  const handleEndPhase = useCallback(() => {
    if (previewEventId !== null) return;
    if (!isMyTurn) return;

    const result = endPhase();
    if (!result.ok) {
      uiLogger.error("Failed to end phase:", result.error);
    }
  }, [isMyTurn, endPhase, previewEventId]);

  // Play all treasures handler
  const handlePlayAllTreasures = useCallback(() => {
    if (previewEventId !== null) return;
    const displayState = previewEventId ? getStateAtEvent(previewEventId) : gameState;
    if (!displayState) return;
    if (!isMyTurn || displayState.phase !== "buy") return;

    const result = playAllTreasures();
    if (!result.ok) {
      uiLogger.error("Failed to play treasures:", result.error);
    }
  }, [isMyTurn, gameState, playAllTreasures, previewEventId, getStateAtEvent]);

  // Submit decision handler
  const handleSubmitDecision = useCallback(() => {
    const displayState = previewEventId ? getStateAtEvent(previewEventId) : gameState;
    if (!displayState) return;
    const myPlayer = myGamePlayerId;
    const myPlayerState = myPlayer ? displayState.players[myPlayer] : null;
    if (!displayState.pendingDecision || !myPlayerState) return;

    const selectedCards = selectedCardIndices.map(i => myPlayerState.hand[i]);
    const result = submitDecision({ selectedCards });
    if (result.ok) {
      setSelectedCardIndices([]);
    } else {
      uiLogger.error("Failed to submit decision:", result.error);
    }
  }, [gameState, myGamePlayerId, selectedCardIndices, submitDecision, previewEventId, getStateAtEvent]);

  // Skip decision handler
  const handleSkipDecision = useCallback(() => {
    const displayState = previewEventId ? getStateAtEvent(previewEventId) : gameState;
    if (!displayState?.pendingDecision?.canSkip) return;

    const result = submitDecision({ selectedCards: [] });
    if (result.ok) {
      setSelectedCardIndices([]);
    }
  }, [gameState, submitDecision, previewEventId, getStateAtEvent]);

  // Use preview state if in time travel mode
  const displayState = previewEventId
    ? getStateAtEvent(previewEventId)
    : gameState;

  if (!displayState) {
    return (
      <div style={styles.loading}>
        Loading game...
      </div>
    );
  }

  const myPlayer = myGamePlayerId;
  const myPlayerState = myPlayer ? displayState.players[myPlayer] : null;
  const playerInfo = displayState.playerInfo;

  // Computed values
  const isActionPhase = displayState.phase === "action";
  const isBuyPhase = displayState.phase === "buy";
  const canBuy = isMyTurn && isBuyPhase && displayState.buys > 0 && !previewEventId;

  const hasPlayableActions = myPlayerState?.hand.some(isActionCard) && displayState.actions > 0;
  const hasTreasuresInHand = myPlayerState?.hand.some(isTreasureCard);

  // VP calculation
  const myVP = myPlayerState ? countVP(getAllCards(myPlayerState)) : 0;

  // Get hint text
  const getHint = () => {
    if (previewEventId) {
      return `Previewing @ ${previewEventId}`;
    }
    if (displayState.pendingDecision && displayState.pendingDecision.player === myPlayer) {
      return displayState.pendingDecision.prompt;
    }
    if (!isMyTurn) {
      const activeName = playerInfo?.[displayState.activePlayer]?.name ?? displayState.activePlayer;
      return `Waiting for ${activeName}...`;
    }
    if (isActionPhase) {
      if (hasPlayableActions) return "Click an Action card to play it";
      return "No actions to play - end phase to continue";
    }
    if (isBuyPhase) {
      if (displayState.coins === 0 && hasTreasuresInHand) {
        return "Play treasures to get coins";
      }
      return `${displayState.coins} coins, ${displayState.buys} buy${displayState.buys !== 1 ? "s" : ""} remaining`;
    }
    return "";
  };

  return (
    <div style={styles.container}>
      {/* Main game area */}
      <div style={styles.mainArea}>
        {/* Turn indicator */}
        <div style={{
          ...styles.turnIndicator,
          background: isMyTurn ? "rgba(34, 197, 94, 0.2)" : "var(--color-bg-secondary)",
          borderColor: isMyTurn ? "rgba(34, 197, 94, 0.5)" : "var(--color-border-primary)",
          color: isMyTurn ? "#22c55e" : "var(--color-text-secondary)",
        }}>
          {isMyTurn ? "Your Turn!" : `${playerInfo?.[displayState.activePlayer]?.name ?? displayState.activePlayer}'s Turn`}
          <span style={styles.phaseTag}>
            {displayState.phase.toUpperCase()} PHASE
          </span>
        </div>

        {/* Supply */}
        <Supply
          state={displayState}
          onBuyCard={handleBuyCard}
          canBuy={canBuy}
          availableCoins={displayState.coins}
          pendingDecision={displayState.pendingDecision}
        />

        {/* Action bar */}
        {isMyTurn && previewEventId === null && (
          <div style={styles.actionBar}>
            <div style={styles.hint}>{getHint()}</div>
            <div style={styles.actionButtons}>
              {isBuyPhase && hasTreasuresInHand && (
                <button onClick={handlePlayAllTreasures} style={styles.button}>
                  Play All Treasures
                </button>
              )}
              <button onClick={handleEndPhase} style={styles.button}>
                End {displayState.phase === "action" ? "Actions" : "Turn"}
              </button>
            </div>
          </div>
        )}

        {/* Decision panel */}
        {displayState.pendingDecision && displayState.pendingDecision.player === myPlayer && (
          <div style={styles.decisionPanel}>
            <div style={styles.decisionPrompt}>{displayState.pendingDecision.prompt}</div>
            <div style={styles.selectedCards}>
              Selected: {selectedCardIndices.length > 0 && myPlayerState ? selectedCardIndices.map(i => myPlayerState.hand[i]).join(", ") : "(none)"}
            </div>
            <div style={styles.decisionButtons}>
              <button
                onClick={handleSubmitDecision}
                style={styles.submitButton}
                disabled={selectedCardIndices.length < (displayState.pendingDecision.min || 0)}
              >
                Confirm
              </button>
              {displayState.pendingDecision.canSkip && (
                <button onClick={handleSkipDecision} style={styles.button}>
                  Skip
                </button>
              )}
            </div>
          </div>
        )}

        {/* My hand */}
        <PlayerArea
          player={myPlayerState ?? { hand: [], deck: [], discard: [], inPlay: [], inPlaySourceIndices: [], deckTopRevealed: false }}
          label="You"
          vpCount={myPlayerState ? myVP : 0}
          isActive={isMyTurn}
          isHuman={true}
          selectedCardIndices={selectedCardIndices}
          onCardClick={handleCardClick}
          pendingDecision={displayState.pendingDecision}
          phase={displayState.phase}
          subPhase={displayState.subPhase}
          loading={!myPlayerState}
          playerId={myPlayer || undefined}
        />
      </div>

      {/* Sidebar - using unified GameSidebar */}
      <GameSidebar
        state={displayState}
        events={events}
        isProcessing={false}
        gameMode="multiplayer"
        localPlayer={myGamePlayerId || undefined}
        onEndGame={() => {
          if (confirm("End game for all players?")) {
            endGame();
          }
        }}
        onBackToHome={() => {
          leaveRoom();
          onBackToHome();
        }}
        onRequestUndo={handleRequestUndo}
      />

      {/* Game over modal */}
      {displayState.gameOver && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              {displayState.winner ? "Game Over!" : "Game Ended"}
            </h2>
            {displayState.winner ? (
              <>
                <div style={styles.winner}>
                  Winner: {players.find(p => p.id === (displayState.playerOrder?.indexOf(displayState.winner!) ?? -1).toString())?.name ?? displayState.winner}
                </div>
                <div style={styles.scores}>
                  {displayState.playerOrder?.map((playerId, idx) => {
                    const pState = displayState.players[playerId];
                    const vp = pState ? countVP(getAllCards(pState)) : 0;
                    const playerName = players[idx]?.name ?? playerId;
                    return (
                      <div key={playerId} style={styles.scoreRow}>
                        {playerName}: {vp} VP
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={styles.winner}>
                A player ended the game
              </div>
            )}
            <button
              onClick={() => {
                leaveRoom();
                onBackToHome();
              }}
              style={styles.button}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Event Devtools */}
      <EventDevtools
        events={events}
        isOpen={showDevtools}
        onToggle={() => setShowDevtools(!showDevtools)}
        onBranchFrom={handleRequestUndo}
        onScrub={(eventId) => {
          setPreviewEventId(eventId);
        }}
      />

      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "grid",
    gridTemplateColumns: "1fr 280px",
    height: "100dvh",
    overflow: "hidden",
    background: "var(--color-bg-primary)",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100dvh",
    color: "var(--color-text-secondary)",
  },
  mainArea: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-4)",
    padding: "var(--space-4)",
    overflow: "auto",
  },
  turnIndicator: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "8px",
    border: "1px solid",
    fontSize: "1rem",
    fontWeight: 600,
  },
  phaseTag: {
    fontSize: "0.75rem",
    padding: "var(--space-1) var(--space-2)",
    background: "var(--color-bg-tertiary)",
    borderRadius: "4px",
  },
  actionBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--space-3)",
    background: "var(--color-bg-secondary)",
    borderRadius: "8px",
    border: "1px solid var(--color-border-primary)",
  },
  hint: {
    color: "var(--color-text-secondary)",
    fontSize: "0.875rem",
  },
  actionButtons: {
    display: "flex",
    gap: "var(--space-2)",
  },
  button: {
    padding: "var(--space-2) var(--space-4)",
    background: "var(--color-bg-tertiary)",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "6px",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.875rem",
  },
  decisionPanel: {
    padding: "var(--space-4)",
    background: "rgba(99, 102, 241, 0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(99, 102, 241, 0.3)",
  },
  decisionPrompt: {
    color: "var(--color-text-primary)",
    fontWeight: 600,
    marginBottom: "var(--space-2)",
  },
  selectedCards: {
    color: "var(--color-text-secondary)",
    fontSize: "0.875rem",
    marginBottom: "var(--space-3)",
  },
  decisionButtons: {
    display: "flex",
    gap: "var(--space-2)",
  },
  submitButton: {
    padding: "var(--space-2) var(--space-4)",
    background: "rgba(99, 102, 241, 0.8)",
    border: "none",
    borderRadius: "6px",
    color: "white",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  sidebar: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
    padding: "var(--space-4)",
    background: "var(--color-bg-secondary)",
    borderLeft: "1px solid var(--color-border-primary)",
    overflow: "auto",
  },
  infoBox: {
    padding: "var(--space-3)",
    background: "var(--color-bg-tertiary)",
    borderRadius: "8px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "var(--space-1) 0",
  },
  infoLabel: {
    color: "var(--color-text-tertiary)",
    fontSize: "0.75rem",
    textTransform: "uppercase",
  },
  infoValue: {
    color: "var(--color-text-primary)",
    fontWeight: 600,
  },
  playersSection: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  sectionTitle: {
    margin: 0,
    marginBottom: "var(--space-2)",
    fontSize: "0.75rem",
    color: "var(--color-text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.05rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerCard: {
    padding: "var(--space-2)",
    borderRadius: "6px",
    border: "1px solid",
  },
  playerName: {
    fontWeight: 600,
    fontSize: "0.875rem",
  },
  playerStats: {
    fontSize: "0.75rem",
    color: "var(--color-text-tertiary)",
  },
  logSection: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
  eventList: {
    flex: 1,
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  eventItem: {
    display: "flex",
    gap: "var(--space-2)",
    padding: "var(--space-1) var(--space-2)",
    fontSize: "0.75rem",
    borderRadius: "4px",
    alignItems: "center",
    position: "relative",
  },
  eventIndex: {
    color: "var(--color-text-tertiary)",
    minWidth: "24px",
    cursor: "pointer",
  },
  eventIdStyle: {
    color: "#6b7280",
    minWidth: "50px",
    fontSize: "10px",
    fontFamily: "monospace",
    cursor: "pointer",
  },
  eventType: {
    color: "var(--color-text-secondary)",
    flex: 1,
    cursor: "pointer",
  },
  undoEventButton: {
    marginLeft: "auto",
    padding: "2px 6px",
    background: "rgba(34, 197, 94, 0.2)",
    border: "1px solid rgba(34, 197, 94, 0.5)",
    borderRadius: "3px",
    color: "#22c55e",
    cursor: "pointer",
    fontSize: "0.875rem",
    lineHeight: 1,
    fontWeight: 600,
    transition: "all 0.15s",
  },
  exitPreviewButton: {
    padding: "var(--space-1) var(--space-2)",
    background: "rgba(99, 102, 241, 0.2)",
    border: "none",
    borderRadius: "4px",
    color: "rgba(99, 102, 241, 1)",
    cursor: "pointer",
    fontSize: "0.625rem",
  },
  undoRequest: {
    padding: "var(--space-3)",
    background: "rgba(251, 191, 36, 0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(251, 191, 36, 0.3)",
  },
  undoTitle: {
    fontWeight: 600,
    color: "var(--color-gold)",
    marginBottom: "var(--space-1)",
  },
  undoInfo: {
    fontSize: "0.875rem",
    color: "var(--color-text-secondary)",
    marginBottom: "var(--space-2)",
  },
  undoProgress: {
    fontSize: "0.75rem",
    color: "var(--color-text-tertiary)",
    marginBottom: "var(--space-2)",
  },
  undoButtons: {
    display: "flex",
    gap: "var(--space-2)",
  },
  approveButton: {
    padding: "var(--space-2) var(--space-3)",
    background: "rgba(34, 197, 94, 0.2)",
    border: "1px solid rgba(34, 197, 94, 0.5)",
    borderRadius: "6px",
    color: "#22c55e",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  denyButton: {
    padding: "var(--space-2) var(--space-3)",
    background: "rgba(239, 68, 68, 0.2)",
    border: "1px solid rgba(239, 68, 68, 0.5)",
    borderRadius: "6px",
    color: "#ef4444",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  homeButton: {
    padding: "var(--space-2) var(--space-3)",
    background: "transparent",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "6px",
    color: "var(--color-text-primary)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.875rem",
  },
  endGameButton: {
    padding: "var(--space-2) var(--space-3)",
    background: "rgba(239, 68, 68, 0.2)",
    border: "1px solid rgba(239, 68, 68, 0.5)",
    borderRadius: "6px",
    color: "#ef4444",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.875rem",
  },
  hostBadge: {
    textAlign: "center",
    fontSize: "0.75rem",
    color: "var(--color-text-tertiary)",
  },
  modal: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0, 0, 0, 0.8)",
    zIndex: 100,
  },
  modalContent: {
    padding: "var(--space-6)",
    background: "var(--color-bg-secondary)",
    borderRadius: "12px",
    textAlign: "center",
    minWidth: "300px",
  },
  modalTitle: {
    margin: 0,
    marginBottom: "var(--space-4)",
    color: "var(--color-gold)",
  },
  winner: {
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "var(--space-4)",
    color: "var(--color-text-primary)",
  },
  scores: {
    marginBottom: "var(--space-4)",
  },
  scoreRow: {
    padding: "var(--space-1) 0",
    color: "var(--color-text-secondary)",
  },
};
