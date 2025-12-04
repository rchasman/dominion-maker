import type { PlayerState } from "../../types/game-state";
import type { GameMode } from "../../types/game-mode";
import { countVP, getAllCards } from "../../lib/board-utils";

interface OpponentBarProps {
  opponent: PlayerState;
  isHumanTurn: boolean;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
}

export function OpponentBar({ opponent, isHumanTurn, gameMode, onGameModeChange }: OpponentBarProps) {
  const opponentVP = countVP(getAllCards(opponent));

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "var(--space-3) var(--space-4)",
      background: !isHumanTurn
        ? "linear-gradient(180deg, rgba(100, 181, 246, 0.15) 0%, rgba(100, 181, 246, 0.05) 100%)"
        : "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
      border: !isHumanTurn ? "1px solid var(--color-ai)" : "1px solid var(--color-border)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <strong style={{ fontSize: "0.875rem", color: "var(--color-text-primary)" }}>Opponent</strong>
          {!isHumanTurn && (
            <span style={{ fontSize: "0.5rem", background: "var(--color-ai)", color: "#fff", padding: "2px 6px", fontWeight: 600 }}>
              PLAYING
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "0.75rem", color: "var(--color-text-secondary)" }}>
          <span>Deck: <strong style={{ color: "var(--color-gold)" }}>{opponent.deck.length}</strong></span>
          <span>Hand: <strong style={{ color: "var(--color-gold)" }}>{opponent.hand.length}</strong></span>
          <span>Discard: <strong style={{ color: "var(--color-gold)" }}>{opponent.discard.length}</strong></span>
        </div>

        <ModeSwitcher gameMode={gameMode} onGameModeChange={onGameModeChange} />
      </div>
      <div style={{
        fontSize: "0.875rem",
        color: "var(--color-victory)",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}>
        <span style={{ color: "var(--color-text-secondary)", fontWeight: 400, fontSize: "0.75rem" }}>VP:</span>
        {opponentVP}
      </div>
    </div>
  );
}

function ModeSwitcher({ gameMode, onGameModeChange }: { gameMode: GameMode; onGameModeChange: (mode: GameMode) => void }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--color-text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05rem" }}>
        Mode:
      </span>
      {(["engine", "hybrid", "llm"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onGameModeChange(mode)}
          style={{
            padding: "3px 8px",
            fontSize: "0.65rem",
            fontWeight: gameMode === mode ? 700 : 400,
            background: gameMode === mode ? "var(--color-victory-dark)" : "transparent",
            color: gameMode === mode ? "#fff" : "var(--color-text-secondary)",
            border: "1px solid",
            borderColor: gameMode === mode ? "var(--color-victory)" : "var(--color-border-secondary)",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.05rem",
            fontFamily: "inherit",
            borderRadius: "3px",
          }}
        >
          {mode === "engine" ? "Engine" : mode === "hybrid" ? "Hybrid" : "LLM"}
        </button>
      ))}
    </div>
  );
}
