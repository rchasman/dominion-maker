const DISABLED_OPACITY = 0.3;

interface TurnNavigationButtonsProps {
  currentTurnIndex: number;
  turnsCount: number;
  hasPrevTurn: boolean;
  hasNextTurn: boolean;
  handlePrevTurn: () => void;
  handleNextTurn: () => void;
}

export function TurnNavigationButtons({
  currentTurnIndex,
  turnsCount,
  hasPrevTurn,
  hasNextTurn,
  handlePrevTurn,
  handleNextTurn,
}: TurnNavigationButtonsProps) {
  const buttonBaseStyle = {
    background: "none",
    border: "none",
    fontSize: "0.85rem",
    fontWeight: 700,
    fontFamily: "inherit",
    padding: "var(--space-2)",
    minWidth: "24px",
    minHeight: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.15s",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
      }}
    >
      <button
        onClick={handlePrevTurn}
        disabled={!hasPrevTurn}
        onMouseEnter={e =>
          hasPrevTurn && (e.currentTarget.style.opacity = "0.5")
        }
        onMouseLeave={e => hasPrevTurn && (e.currentTarget.style.opacity = "1")}
        style={{
          ...buttonBaseStyle,
          color: hasPrevTurn
            ? "var(--color-gold)"
            : "var(--color-text-secondary)",
          cursor: hasPrevTurn ? "pointer" : "not-allowed",
          opacity: hasPrevTurn ? 1 : DISABLED_OPACITY,
        }}
      >
        ↶
      </button>
      <span
        style={{
          color: "var(--color-text-secondary)",
          fontWeight: 400,
        }}
      >
        Turn {currentTurnIndex + 1} of {turnsCount}
      </span>
      <button
        onClick={handleNextTurn}
        disabled={!hasNextTurn}
        onMouseEnter={e =>
          hasNextTurn && (e.currentTarget.style.opacity = "0.5")
        }
        onMouseLeave={e => hasNextTurn && (e.currentTarget.style.opacity = "1")}
        style={{
          ...buttonBaseStyle,
          color: hasNextTurn
            ? "var(--color-gold)"
            : "var(--color-text-secondary)",
          cursor: hasNextTurn ? "pointer" : "not-allowed",
          opacity: hasNextTurn ? 1 : DISABLED_OPACITY,
        }}
      >
        ↷
      </button>
    </div>
  );
}
