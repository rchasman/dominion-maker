import { useGame } from "../context/GameContext";

export function StartScreen() {
  const { gameMode, setGameMode, startGame } = useGame();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        gap: "var(--space-8)",
        background: "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
      }}
    >
      <h1 style={{
        margin: 0,
        fontSize: "3rem",
        color: "var(--color-gold)",
        textShadow: "var(--shadow-glow-gold)",
        letterSpacing: "0.25rem",
      }}>
        DOMINION
      </h1>
      <p style={{
        color: "var(--color-text-secondary)",
        margin: 0,
        fontSize: "0.875rem",
        textTransform: "uppercase",
        letterSpacing: "0.125rem"
      }}>
        Base Game
      </p>

      <div style={{
        display: "flex",
        gap: "var(--space-4)",
        padding: "var(--space-4)",
        background: "var(--color-bg-secondary)",
        border: "1px solid var(--color-border-primary)",
        borderRadius: "8px",
      }}>
        <ModeButton mode="engine" current={gameMode} onClick={setGameMode}>
          Engine Mode
        </ModeButton>
        <ModeButton mode="hybrid" current={gameMode} onClick={setGameMode}>
          Hybrid Mode
        </ModeButton>
        <ModeButton mode="llm" current={gameMode} onClick={setGameMode}>
          LLM Mode
        </ModeButton>
      </div>

      <p style={{
        color: "var(--color-text-tertiary)",
        margin: 0,
        fontSize: "0.75rem",
        maxWidth: "500px",
        textAlign: "center",
        lineHeight: 1.6,
      }}>
        {gameMode === "engine"
          ? "Hard-coded rules engine with explicit card implementations"
          : gameMode === "hybrid"
          ? "Engine for human moves, MAKER consensus for AI turns (GPT-4o + Claude)"
          : "Pure MAKER consensus for all moves (GPT-4o + Claude validate each step)"}
      </p>

      <button
        onClick={startGame}
        style={{
          padding: "var(--space-6) var(--space-10)",
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
        Start Game
      </button>
    </div>
  );
}

function ModeButton({
  mode,
  current,
  onClick,
  children
}: {
  mode: "engine" | "hybrid" | "llm";
  current: string;
  onClick: (mode: "engine" | "hybrid" | "llm") => void;
  children: React.ReactNode;
}) {
  const isActive = mode === current;
  return (
    <button
      onClick={() => onClick(mode)}
      style={{
        padding: "var(--space-3) var(--space-6)",
        fontSize: "0.75rem",
        fontWeight: isActive ? 700 : 400,
        background: isActive ? "var(--color-victory-dark)" : "transparent",
        color: isActive ? "#fff" : "var(--color-text-secondary)",
        border: "1px solid",
        borderColor: isActive ? "var(--color-victory)" : "var(--color-border-primary)",
        cursor: "pointer",
        textTransform: "uppercase",
        letterSpacing: "0.1rem",
        fontFamily: "inherit",
        borderRadius: "4px",
      }}
    >
      {children}
    </button>
  );
}
