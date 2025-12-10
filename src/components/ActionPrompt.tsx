import type { CardName } from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { Card } from "./Card";

interface ActionPromptProps {
  decision: DecisionRequest;
  selectedCards: CardName[];
  onToggleCard: (card: CardName) => void;
  onConfirm: () => void;
  onSkip?: () => void;
}

export function ActionPrompt({
  decision,
  selectedCards,
  onToggleCard,
  onConfirm,
  onSkip,
}: ActionPromptProps) {
  // Only show for simple selection mode (no actions)
  if (decision.actions) {
    return null;
  }

  const minCount = decision.min ?? 0;
  const maxCount = decision.max ?? 1;
  const canConfirm =
    selectedCards.length >= minCount && selectedCards.length <= maxCount;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#fff",
        borderTop: "3px solid #4CAF50",
        padding: "16px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h3 style={{ margin: "0 0 8px 0" }}>{decision.prompt}</h3>
        <p style={{ margin: "0 0 12px 0", color: "#666", fontSize: "14px" }}>
          Select {minCount === maxCount ? minCount : `${minCount}-${maxCount}`}{" "}
          card(s). Selected: {selectedCards.length}
        </p>

        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "16px",
          }}
        >
          {(decision.cardOptions || []).map(card => (
            <Card
              key={card}
              name={card}
              onClick={() => onToggleCard(card)}
              selected={selectedCards.includes(card)}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              background: canConfirm ? "#4CAF50" : "#ccc",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
          >
            Confirm
          </button>
          {decision.min === 0 && (
            <button
              onClick={onSkip}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                background: "#666",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
