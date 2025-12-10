import { formatPlayerName } from "../../lib/board-utils";

interface GameOverModalProps {
  winner: string | null;
  mainPlayerId: string;
  opponentPlayerId: string;
  isMainPlayerAI: boolean;
  isOpponentAI: boolean;
  mainPlayerVP: number;
  opponentVP: number;
  turnCount: number;
  onNewGame: () => void;
}

export function GameOverModal({
  winner,
  mainPlayerId,
  opponentPlayerId,
  isMainPlayerAI,
  isOpponentAI,
  mainPlayerVP,
  opponentVP,
  turnCount,
  onNewGame,
}: GameOverModalProps) {
  const winnerName =
    winner === mainPlayerId
      ? formatPlayerName(mainPlayerId, isMainPlayerAI)
      : formatPlayerName(opponentPlayerId, isOpponentAI);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgb(0 0 0 / 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
          padding: "var(--space-10) 3.75rem",
          textAlign: "center",
          border: "2px solid var(--color-gold)",
          boxShadow: "var(--shadow-game-over)",
        }}
      >
        <h2
          style={{
            margin: "0 0 var(--space-6) 0",
            color: "var(--color-gold)",
            fontSize: "1.75rem",
          }}
        >
          Game Over
        </h2>
        <p
          style={{
            fontSize: "1.375rem",
            margin: 0,
            color: winner === mainPlayerId ? "var(--color-victory)" : "#ef5350",
          }}
        >
          {winnerName} wins!
        </p>
        <div
          style={{
            marginBlockStart: "var(--space-3)",
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
          }}
        >
          {turnCount} turns
        </div>
        <div
          style={{
            marginBlockStart: "var(--space-4)",
            fontSize: "1rem",
            color: "var(--color-text-secondary)",
          }}
        >
          You: {mainPlayerVP} VP | Opponent: {opponentVP} VP
        </div>
        <button
          onClick={onNewGame}
          style={{
            marginBlockStart: "var(--space-6)",
            padding: "var(--space-4) var(--space-8)",
            fontSize: "0.875rem",
            fontWeight: 600,
            background:
              "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
            color: "#fff",
            border: "2px solid var(--color-victory)",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.125rem",
            fontFamily: "inherit",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          New Game
        </button>
      </div>
    </div>
  );
}
