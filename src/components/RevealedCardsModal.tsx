import type { CardName } from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { Card } from "./Card";

interface RevealedCardsModalProps {
  pendingDecision: DecisionRequest;
  selectedCardIndices: number[];
  onCardClick: (card: CardName, index: number) => void;
}

export function RevealedCardsModal({
  pendingDecision,
  selectedCardIndices,
  onCardClick,
}: RevealedCardsModalProps) {
  if (
    !pendingDecision ||
    pendingDecision.from !== "revealed" ||
    !pendingDecision.cardOptions ||
    pendingDecision.cardOptions.length === 0
  ) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
    >
      <div
        style={{
          background: "var(--color-bg-primary)",
          border: "2px solid rgb(205 133 63)",
          borderRadius: "8px",
          padding: "var(--space-6)",
          maxWidth: "800px",
          width: "100%",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div
          style={{
            fontSize: "1rem",
            color: "rgb(205 133 63)",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBlockEnd: "var(--space-4)",
            textAlign: "center",
          }}
        >
          Revealed from Deck
        </div>
        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            minBlockSize: "calc(var(--card-height-large) + var(--space-2))",
          }}
        >
          {pendingDecision.cardOptions.map((card, i) => {
            const isSelectable =
              pendingDecision.cardOptions?.includes(card) ?? true;
            const isSelected =
              pendingDecision.from === "revealed" &&
              selectedCardIndices.includes(i);
            return (
              <Card
                key={`${card}-${i}`}
                name={card}
                size="large"
                onClick={() => onCardClick(card, i)}
                selected={isSelected}
                highlightMode={
                  pendingDecision.stage === "trash"
                    ? "trash"
                    : pendingDecision.stage === "discard"
                      ? "discard"
                      : undefined
                }
                disabled={!isSelectable}
              />
            );
          })}
        </div>
        <div
          style={{
            marginBlockStart: "var(--space-4)",
            fontSize: "0.875rem",
            color: "var(--color-text-secondary)",
            textAlign: "center",
          }}
        >
          {pendingDecision.prompt}
        </div>
      </div>
    </div>
  );
}
