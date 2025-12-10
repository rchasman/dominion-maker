interface ActionBarProps {
  hintText: string;
  isBuyPhase: boolean;
  hasTreasuresInHand: boolean;
  phase: string;
  onPlayAllTreasures: () => void;
  onEndPhase: () => void;
}

export function ActionBar({
  hintText,
  isBuyPhase,
  hasTreasuresInHand,
  phase,
  onPlayAllTreasures,
  onEndPhase,
}: ActionBarProps) {
  return (
    <div style={styles.actionBar}>
      <div style={styles.hint}>{hintText}</div>
      <div style={styles.actionButtons}>
        {isBuyPhase && hasTreasuresInHand && (
          <button onClick={onPlayAllTreasures} style={styles.button}>
            Play All Treasures
          </button>
        )}
        <button onClick={onEndPhase} style={styles.button}>
          End {phase === "action" ? "Actions" : "Turn"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
};
