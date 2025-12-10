import type { CardName, Phase } from "../../types/game-state";
import type { DecisionRequest } from "../../events/types";
import { Card } from "../Card";
import { CARDS } from "../../data/cards";

const PLACEHOLDER_HAND_SIZE = 5;

interface HandSectionProps {
  hand: CardName[];
  showCards: boolean;
  loading: boolean;
  selectedCardIndices: number[];
  pendingDecision?: DecisionRequest | null;
  isInteractive: boolean;
  isActive: boolean;
  playerId?: string;
  phase: Phase;
  actions?: number;
  onCardClick?: (card: CardName, index: number) => void;
}

function getHandCardHighlightMode(
  card: CardName,
  pendingDecision: DecisionRequest | null | undefined,
  isInteractive: boolean,
  playerId: string | undefined,
): "trash" | "discard" | "gain" | undefined {
  if (!pendingDecision || !isInteractive) return undefined;
  if (pendingDecision.player !== playerId) return undefined;
  if (pendingDecision.from !== "hand") return undefined;

  const isSelectable = pendingDecision.cardOptions?.includes(card) ?? true;
  if (!isSelectable) return undefined;

  if (pendingDecision.stage === "trash") return "trash";
  if (pendingDecision.stage === "discard") return "discard";

  return undefined;
}

interface CardDisabledContext {
  card: CardName;
  isInteractive: boolean;
  isActive: boolean;
  pendingDecision: DecisionRequest | null | undefined;
  playerId: string | undefined;
  phase: Phase;
  actions: number | undefined;
}

function isHandCardDisabled(context: CardDisabledContext): boolean {
  const {
    card,
    isInteractive,
    isActive,
    pendingDecision,
    playerId,
    phase,
    actions,
  } = context;

  if (!isInteractive) return true;
  if (!isActive) return true;

  if (
    pendingDecision &&
    pendingDecision.player === playerId &&
    pendingDecision.from === "hand"
  ) {
    const cardOptions = pendingDecision.cardOptions ?? [];
    return cardOptions.length > 0 && !cardOptions.includes(card);
  }

  const cardDef = CARDS[card];

  if (cardDef.types.includes("victory")) {
    return true;
  }

  if (cardDef.types.includes("action")) {
    if (phase !== "action" || (actions !== undefined && actions === 0)) {
      return true;
    }
  }

  if (cardDef.types.includes("treasure") && phase !== "buy") {
    return true;
  }

  return false;
}

function HandCountDisplay({ handLength }: { handLength: number }) {
  return (
    <div
      style={{
        padding: "var(--space-3) var(--space-6)",
        background: "rgb(255 255 255 / 0.05)",
        border: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        color: "var(--color-text-secondary)",
        fontSize: "0.75rem",
      }}
    >
      {handLength} cards in hand
    </div>
  );
}

function HandCardRenderer({
  card,
  index,
  selectedCardIndices,
  pendingDecision,
  isInteractive,
  isActive,
  playerId,
  phase,
  actions,
  onCardClick,
}: {
  card: CardName;
  index: number;
  selectedCardIndices: number[];
  pendingDecision: DecisionRequest | null | undefined;
  isInteractive: boolean;
  isActive: boolean;
  playerId: string | undefined;
  phase: Phase;
  actions: number | undefined;
  onCardClick?: (card: CardName, index: number) => void;
}) {
  const isSelected =
    (!pendingDecision ||
      pendingDecision.from === "hand" ||
      pendingDecision.from === "discard") &&
    selectedCardIndices.includes(index);

  return (
    <div key={`${card}-${index}-wrapper`}>
      <Card
        key={`${card}-${index}`}
        name={card}
        size="large"
        onClick={() => onCardClick?.(card, index)}
        selected={isSelected}
        highlightMode={getHandCardHighlightMode(
          card,
          pendingDecision,
          isInteractive,
          playerId,
        )}
        disabled={isHandCardDisabled({
          card,
          isInteractive,
          isActive,
          pendingDecision,
          playerId,
          phase,
          actions,
        })}
      />
    </div>
  );
}

export function HandSection({
  hand,
  showCards,
  loading,
  selectedCardIndices,
  pendingDecision,
  isInteractive,
  isActive,
  playerId,
  phase,
  actions,
  onCardClick,
}: HandSectionProps) {
  if (!showCards) {
    return <HandCountDisplay handLength={hand.length} />;
  }

  return (
    <div
      className="hand-container"
      style={{
        position: "relative",
        minInlineSize: 0,
        padding: "var(--space-2)",
        background: "rgb(255 255 255 / 0.05)",
        border: "1px solid var(--color-border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          insetBlockStart: "var(--space-1)",
          insetInlineStart: "var(--space-2)",
          fontSize: "0.5625rem",
          color: "var(--color-text-muted)",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        Hand ({hand.length})
      </div>
      <div className="hand-grid">
        {loading
          ? Array.from({ length: PLACEHOLDER_HAND_SIZE }).map((_, i) => (
              <div
                key={i}
                style={{
                  animation: "subtlePulse 3s ease-in-out infinite",
                }}
              >
                <Card
                  name="Copper"
                  showBack={true}
                  size="large"
                  disabled={true}
                />
              </div>
            ))
          : hand.map((card, i) => (
              <HandCardRenderer
                key={`${card}-${i}`}
                card={card}
                index={i}
                selectedCardIndices={selectedCardIndices}
                pendingDecision={pendingDecision}
                isInteractive={isInteractive}
                isActive={isActive}
                playerId={playerId}
                phase={phase}
                actions={actions}
                onCardClick={onCardClick}
              />
            ))}
      </div>
    </div>
  );
}
