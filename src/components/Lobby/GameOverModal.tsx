import { useCallback } from "react";
import { countVP, getAllCards } from "../../lib/board-utils";
import type { GameState, Player } from "../../types/game-state";
import type { PlayerInfo } from "../../multiplayer/p2p-room";

interface GameOverModalProps {
  displayState: GameState;
  players: PlayerInfo[];
  onBackToHome: () => void;
  leaveRoom: () => void;
}

const ZERO = 0;
const NEGATIVE_ONE = -1;

export function GameOverModal({
  displayState,
  players,
  onBackToHome,
  leaveRoom,
}: GameOverModalProps) {
  const handleOk = useCallback(() => {
    leaveRoom();
    onBackToHome();
  }, [leaveRoom, onBackToHome]);

  const getWinnerName = (winnerId: Player): string => {
    const winnerIndex = displayState.playerOrder?.indexOf(winnerId) ?? NEGATIVE_ONE;
    return (
      players.find(p => p.id === winnerIndex.toString())?.name ?? winnerId
    );
  };

  const scoreRows = displayState.playerOrder?.map((playerId, idx) => {
    const pState = displayState.players[playerId];
    const vp = pState ? countVP(getAllCards(pState)) : ZERO;
    const playerName = players[idx]?.name ?? playerId;
    return (
      <div key={playerId} style={styles.scoreRow}>
        {playerName}: {vp} VP
      </div>
    );
  });

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <h2 style={styles.modalTitle}>
          {displayState.winner ? "Game Over!" : "Game Ended"}
        </h2>
        {displayState.winner ? (
          <>
            <div style={styles.winner}>
              Winner: {getWinnerName(displayState.winner)}
            </div>
            <div style={styles.scores}>{scoreRows}</div>
          </>
        ) : (
          <div style={styles.winner}>A player ended the game</div>
        )}
        <button onClick={handleOk} style={styles.button}>
          OK
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
};
