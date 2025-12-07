interface GameOverModalProps {
  winner: string | null;
  humanVP: number;
  opponentVP: number;
  onNewGame: () => void;
}

export function GameOverModal({ winner, humanVP, opponentVP, onNewGame }: GameOverModalProps) {
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
          background: "linear-gradient(180deg, var(--color-bg-surface) 0%, var(--color-bg-surface-alt) 100%)",
          padding: "var(--space-10) 3.75rem",
          textAlign: "center",
          border: "2px solid var(--color-gold)",
          boxShadow: "var(--shadow-game-over)",
        }}
      >
        <h2 style={{ margin: "0 0 var(--space-6) 0", color: "var(--color-gold)", fontSize: "1.75rem" }}>Game Over</h2>
        <p style={{ fontSize: "1.375rem", margin: 0, color: winner === "human" ? "var(--color-victory)" : "#ef5350" }}>
          {winner === "human" ? "Victory!" : "Defeat"}
        </p>
        <div style={{ marginBlockStart: "var(--space-4)", fontSize: "1rem", color: "var(--color-text-secondary)" }}>
          You: {humanVP} VP | Opponent: {opponentVP} VP
        </div>
        <button
          onClick={onNewGame}
          style={{
            marginBlockStart: "var(--space-6)",
            padding: "var(--space-4) var(--space-8)",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
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
