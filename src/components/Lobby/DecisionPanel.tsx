import type { CardName, DecisionRequest } from "../../types/game-state";

interface DecisionPanelProps {
  pendingDecision: DecisionRequest;
  selectedCardIndices: number[];
  myPlayerHand: CardName[];
  onSubmitDecision: () => void;
  onSkipDecision: () => void;
}

const ZERO = 0;
const DEFAULT_MIN_DECISION_COUNT = 0;

export function DecisionPanel({
  pendingDecision,
  selectedCardIndices,
  myPlayerHand,
  onSubmitDecision,
  onSkipDecision,
}: DecisionPanelProps) {
  const selectedCardsText =
    selectedCardIndices.length > ZERO
      ? selectedCardIndices.map(i => myPlayerHand[i]).join(", ")
      : "(none)";

  const minRequired = pendingDecision.min ?? DEFAULT_MIN_DECISION_COUNT;
  const isDisabled = selectedCardIndices.length < minRequired;

  return (
    <div style={styles.decisionPanel}>
      <div style={styles.decisionPrompt}>{pendingDecision.prompt}</div>
      <div style={styles.selectedCards}>Selected: {selectedCardsText}</div>
      <div style={styles.decisionButtons}>
        <button
          onClick={onSubmitDecision}
          style={styles.submitButton}
          disabled={isDisabled}
        >
          Confirm
        </button>
        {pendingDecision.canSkip && (
          <button onClick={onSkipDecision} style={styles.button}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
};
