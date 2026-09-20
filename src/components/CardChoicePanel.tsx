import type { CardName } from "../types/game-state";
import type { PendingChoice } from "../types/pending-choice";
import { Card } from "./Card";
import { DecisionPanelFrame } from "./DecisionPanelFrame";

type DecisionChoice = Extract<PendingChoice, { choiceType: "decision" }>;

const SOURCE_LABELS: Record<NonNullable<DecisionChoice["from"]>, string> = {
  hand: "Hand",
  supply: "Supply",
  revealed: "Revealed",
  options: "Options",
  discard: "Discard pile",
};

function getHighlightMode(
  intent: DecisionChoice["intent"],
): "trash" | "discard" | "gain" | undefined {
  if (intent === "trash") return "trash";
  if (intent === "discard") return "discard";
  if (intent === "topdeck" || intent === "gain") return "gain";
  return undefined;
}

interface CardChoicePanelProps {
  pendingChoice: DecisionChoice;
  selectedCardIndices: number[];
  onCardClick: (card: CardName, index: number) => void;
}

export function CardChoicePanel({
  pendingChoice,
  selectedCardIndices,
  onCardClick,
}: CardChoicePanelProps) {
  const highlightMode = getHighlightMode(pendingChoice.intent);
  const label = pendingChoice.from
    ? SOURCE_LABELS[pendingChoice.from]
    : "Decision";

  return (
    <DecisionPanelFrame label={label}>
      <div
        style={{
          fontSize: "0.6875rem",
          color: "#fbbf24",
          fontWeight: 600,
          textAlign: "center",
          margin: "var(--space-3) 0 var(--space-2)",
        }}
      >
        {pendingChoice.prompt}
      </div>
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          flexWrap: "wrap",
          justifyContent: "center",
          padding: "var(--space-2)",
        }}
      >
        {pendingChoice.cardOptions.map((card, index) => {
          const selected = selectedCardIndices.includes(index);
          return (
            <Card
              key={`${card}-${index}`}
              name={card}
              size="large"
              cardId={`choice-${index}-${card}`}
              onClick={() => onCardClick(card, index)}
              selected={selected}
              {...(!selected &&
                highlightMode !== undefined && { highlightMode })}
            />
          );
        })}
      </div>
    </DecisionPanelFrame>
  );
}
