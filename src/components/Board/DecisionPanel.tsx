import type { CardName, PendingDecision } from "../../types/game-state";

interface DecisionPanelProps {
  pendingDecision: PendingDecision;
  onCardClick: (card: CardName, index: number) => void;
}

export function DecisionPanel({ pendingDecision, onCardClick }: DecisionPanelProps) {
  if (pendingDecision.type !== "choose_card_from_options") return null;

  return (
    <div style={{
      padding: "var(--space-4)",
      background: "rgba(255, 215, 0, 0.15)",
      border: "2px solid var(--color-gold)",
      borderRadius: "8px",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
    }}>
      <div style={{
        fontSize: "0.875rem",
        fontWeight: 700,
        color: "var(--color-gold-bright)",
        textAlign: "center",
      }}>
        {pendingDecision.prompt}
      </div>
      <div style={{
        display: "flex",
        gap: "var(--space-3)",
        justifyContent: "center",
        flexWrap: "wrap",
      }}>
        {pendingDecision.options.map((option) => {
          const optionStr = option as string;
          return (
            <button
              key={option}
              onClick={() => onCardClick(option as CardName, 0)}
              style={{
                padding: "var(--space-3) var(--space-6)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background: optionStr === "Trash"
                  ? "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)"
                  : optionStr === "Discard"
                  ? "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)"
                  : optionStr === "Skip"
                  ? "linear-gradient(180deg, #6b7280 0%, #4b5563 100%)"
                  : "linear-gradient(180deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                border: "2px solid rgba(255, 255, 255, 0.3)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.05rem",
                fontFamily: "inherit",
                borderRadius: "6px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
