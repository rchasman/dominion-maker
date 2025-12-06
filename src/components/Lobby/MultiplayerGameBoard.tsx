/**
 * Multiplayer Game Board
 *
 * Full game board for multiplayer games using the event-driven engine.
 * Provides card interactions, action bar, and game state display.
 */
import { useState, useCallback } from "react";
import { useMultiplayer } from "../../context/MultiplayerContext";
import { Supply } from "../Supply";
import { PlayerArea } from "../PlayerArea";
import { EventDevtools } from "../EventDevtools";
import { countVP, getAllCards } from "../../lib/board-utils";
import { isActionCard, isTreasureCard } from "../../data/cards";
import type { CardName, Player } from "../../types/game-state";

interface MultiplayerGameBoardProps {
  onBackToHome: () => void;
}

export function MultiplayerGameBoard({ onBackToHome }: MultiplayerGameBoardProps) {
  const {
    gameState,
    events,
    pendingUndo,
    myPeerId,
    myPlayerIndex,
    myGamePlayerId,
    isMyTurn,
    isHost,
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
    approveUndo,
    denyUndo,
    getStateAt,
  } = useMultiplayer();

  const [selectedCards, setSelectedCards] = useState<CardName[]>([]);
  const [previewEventIndex, setPreviewEventIndex] = useState<number | null>(null);
  const [showDevtools, setShowDevtools] = useState(false);

  // Use preview state if in time travel mode
  const displayState = previewEventIndex !== null
    ? getStateAt(previewEventIndex)
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
  const canBuy = isMyTurn && isBuyPhase && displayState.buys > 0 && previewEventIndex === null;

  const hasPlayableActions = myPlayerState?.hand.some(isActionCard) && displayState.actions > 0;
  const hasTreasuresInHand = myPlayerState?.hand.some(isTreasureCard);

  // VP calculation
  const myVP = myPlayerState ? countVP(getAllCards(myPlayerState)) : 0;

  // Card click handler
  const handleCardClick = useCallback((card: CardName) => {
    if (previewEventIndex !== null) return; // No actions in preview mode
    if (!isMyTurn) return;

    // If we have a pending decision, add to selection
    if (displayState.pendingDecision) {
      const decision = displayState.pendingDecision;
      const maxCount = decision.maxCount || 1;

      if (selectedCards.includes(card)) {
        setSelectedCards(prev => prev.filter(c => c !== card));
      } else if (selectedCards.length < maxCount) {
        setSelectedCards(prev => [...prev, card]);
      }
      return;
    }

    // Action phase - play action cards
    if (isActionPhase && isActionCard(card) && displayState.actions > 0) {
      const result = playAction(card);
      if (!result.ok) {
        console.error("Failed to play action:", result.error);
      }
      return;
    }

    // Buy phase - play treasures
    if (isBuyPhase && isTreasureCard(card)) {
      const result = playTreasure(card);
      if (!result.ok) {
        console.error("Failed to play treasure:", result.error);
      }
      return;
    }
  }, [isMyTurn, displayState, selectedCards, isActionPhase, isBuyPhase, playAction, playTreasure, previewEventIndex]);

  // Buy card handler
  const handleBuyCard = useCallback((card: CardName) => {
    if (previewEventIndex !== null) return;
    if (!canBuy) return;

    const result = buyCard(card);
    if (!result.ok) {
      console.error("Failed to buy card:", result.error);
    }
  }, [canBuy, buyCard, previewEventIndex]);

  // End phase handler
  const handleEndPhase = useCallback(() => {
    if (previewEventIndex !== null) return;
    if (!isMyTurn) return;

    const result = endPhase();
    if (!result.ok) {
      console.error("Failed to end phase:", result.error);
    }
  }, [isMyTurn, endPhase, previewEventIndex]);

  // Play all treasures handler
  const handlePlayAllTreasures = useCallback(() => {
    if (previewEventIndex !== null) return;
    if (!isMyTurn || !isBuyPhase) return;

    const result = playAllTreasures();
    if (!result.ok) {
      console.error("Failed to play treasures:", result.error);
    }
  }, [isMyTurn, isBuyPhase, playAllTreasures, previewEventIndex]);

  // Submit decision handler
  const handleSubmitDecision = useCallback(() => {
    if (!displayState.pendingDecision) return;

    const result = submitDecision({ selectedCards });
    if (result.ok) {
      setSelectedCards([]);
    } else {
      console.error("Failed to submit decision:", result.error);
    }
  }, [displayState.pendingDecision, selectedCards, submitDecision]);

  // Skip decision handler
  const handleSkipDecision = useCallback(() => {
    if (!displayState.pendingDecision?.canSkip) return;

    const result = submitDecision({ selectedCards: [] });
    if (result.ok) {
      setSelectedCards([]);
    }
  }, [displayState.pendingDecision, submitDecision]);

  // Get hint text
  const getHint = () => {
    if (previewEventIndex !== null) {
      return `Previewing turn ${Math.floor(previewEventIndex / 10) + 1} (event ${previewEventIndex})`;
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
        {isMyTurn && previewEventIndex === null && (
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
              Selected: {selectedCards.length > 0 ? selectedCards.join(", ") : "(none)"}
            </div>
            <div style={styles.decisionButtons}>
              <button
                onClick={handleSubmitDecision}
                style={styles.submitButton}
                disabled={selectedCards.length < (displayState.pendingDecision.minCount || 0)}
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
          player={myPlayerState ?? { hand: [], deck: [], discard: [], inPlay: [], deckTopRevealed: false }}
          label="You"
          vpCount={myPlayerState ? myVP : 0}
          isActive={isMyTurn}
          isHuman={true}
          selectedCards={selectedCards}
          onCardClick={handleCardClick}
          pendingDecision={displayState.pendingDecision}
          phase={displayState.phase}
          subPhase={displayState.subPhase}
          loading={!myPlayerState}
        />
      </div>

      {/* Sidebar */}
      <div style={styles.sidebar}>
        {/* Game info */}
        <div style={styles.infoBox}>
          <InfoRow label="Turn" value={displayState.turn.toString()} />
          <InfoRow label="Actions" value={displayState.actions.toString()} />
          <InfoRow label="Buys" value={displayState.buys.toString()} />
          <InfoRow label="Coins" value={`$${displayState.coins}`} />
        </div>

        {/* Players */}
        <div style={styles.playersSection}>
          <h3 style={styles.sectionTitle}>Players</h3>
          {displayState.playerOrder?.map((playerId) => {
            const info = playerInfo?.[playerId];
            const pState = displayState.players[playerId];
            const isActive = displayState.activePlayer === playerId;
            const isMe = playerId === myPlayer;
            const vp = pState ? countVP(getAllCards(pState)) : 0;

            return (
              <div
                key={playerId}
                style={{
                  ...styles.playerCard,
                  borderColor: isActive ? "var(--color-gold)" : isMe ? "rgba(34, 197, 94, 0.3)" : "var(--color-border-primary)",
                  background: isMe ? "rgba(34, 197, 94, 0.1)" : "var(--color-bg-tertiary)",
                }}
              >
                <div style={styles.playerName}>
                  {info?.name ?? playerId}
                  {isMe && " (you)"}
                </div>
                <div style={styles.playerStats}>
                  Hand: {pState?.hand.length ?? 0} | Deck: {pState?.deck.length ?? 0} | VP: {vp}
                </div>
              </div>
            );
          })}
        </div>

        {/* Event log / Time travel */}
        <div style={styles.logSection}>
          <h3 style={styles.sectionTitle}>
            Event Log ({events.length})
            {previewEventIndex !== null && (
              <button
                onClick={() => setPreviewEventIndex(null)}
                style={styles.exitPreviewButton}
              >
                Exit Preview
              </button>
            )}
          </h3>
          <div style={styles.eventList}>
            {events
              .slice(-20)
              .map((event, i) => {
                const actualIndex = events.length - 20 + i;
                const isPreview = previewEventIndex === actualIndex;
                const isSetupEvent = ["GAME_INITIALIZED", "INITIAL_DECK_DEALT", "INITIAL_HAND_DRAWN"].includes(event.type);
                const isInitialTurn = event.type === "TURN_STARTED" && (event as any).turn === 1;

                // Find first TURN_STARTED event to use as index 0
                const firstTurnIndex = events.findIndex(e => e.type === "TURN_STARTED");
                const displayIndex = actualIndex - firstTurnIndex;
                const eventIndex = actualIndex; // Use actual index for undo

                return (
                  <div
                    key={eventIndex}
                    style={{
                      ...styles.eventItem,
                      background: isPreview ? "rgba(99, 102, 241, 0.2)" : undefined,
                    }}
                  >
                    <span
                      style={styles.eventIndex}
                      onClick={() => setPreviewEventIndex(eventIndex)}
                    >
                      {displayIndex}
                    </span>
                    <span
                      style={styles.eventType}
                      onClick={() => setPreviewEventIndex(eventIndex)}
                    >
                      {event.type}
                    </span>
                    {!pendingUndo && !isSetupEvent && !isInitialTurn && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestUndo(eventIndex, "Request from event log");
                        }}
                        style={styles.undoEventButton}
                        title="Request undo to here"
                      >
                        ↶
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* Undo request */}
        {pendingUndo && pendingUndo.byPlayer !== myPeerId && (
          <div style={styles.undoRequest}>
            <div style={styles.undoTitle}>Undo Requested</div>
            <div style={styles.undoInfo}>
              {players.find(p => p.id === pendingUndo.byPlayer)?.name ?? pendingUndo.byPlayer} wants to undo to event {pendingUndo.toEventIndex}
              {pendingUndo.reason && `: "${pendingUndo.reason}"`}
            </div>
            <div style={styles.undoProgress}>
              Approvals: {pendingUndo.approvals.length} / {pendingUndo.needed}
            </div>
            <div style={styles.undoButtons}>
              <button onClick={approveUndo} style={styles.approveButton}>Approve</button>
              <button onClick={denyUndo} style={styles.denyButton}>Deny</button>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <button
            onClick={() => {
              if (confirm("End game for all players?")) {
                endGame();
              }
            }}
            style={styles.endGameButton}
          >
            End Game
          </button>
          <button
            onClick={() => {
              leaveRoom();
              onBackToHome();
            }}
            style={styles.homeButton}
          >
            ← Back to Home
          </button>
        </div>

        {isHost && (
          <div style={styles.hostBadge}>You are the host</div>
        )}
      </div>

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
        currentState={gameState}
        isOpen={showDevtools}
        onToggle={() => setShowDevtools(!showDevtools)}
        onBranchFrom={(eventIndex) => {
          requestUndo(eventIndex, "Branch from event timeline");
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
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
  },
  eventIndex: {
    color: "var(--color-text-tertiary)",
    minWidth: "24px",
    cursor: "pointer",
  },
  eventType: {
    color: "var(--color-text-secondary)",
    flex: 1,
    cursor: "pointer",
  },
  undoEventButton: {
    padding: "2px 6px",
    background: "transparent",
    border: "1px solid var(--color-border-primary)",
    borderRadius: "3px",
    color: "var(--color-text-tertiary)",
    cursor: "pointer",
    fontSize: "1rem",
    marginLeft: "auto",
    lineHeight: 1,
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
