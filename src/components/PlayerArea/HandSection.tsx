import type {
  CardName,
  Phase,
} from "../../types/game-state";
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

function isHandCardDisabled(
  card: CardName,
  isInteractive: boolean,
  isActive: boolean,
  pendingDecision: DecisionRequest | null | undefined,
  playerId: string | undefined,
  phase: Phase,
  actions: number | undefined,
): boolean {
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
        {hand.length} cards in hand
      </div>
    );
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
          : hand.map((card, i) => {
              const isSelected =
                (!pendingDecision ||
                  pendingDecision.from === "hand" ||
                  pendingDecision.from === "discard") &&
                selectedCardIndices.includes(i);
              return (
                <div key={`${card}-${i}-wrapper`}>
                  <Card
                    key={`${card}-${i}`}
                    name={card}
                    size="large"
                    onClick={() => onCardClick?.(card, i)}
                    selected={isSelected}
                    highlightMode={getHandCardHighlightMode(
                      card,
                      pendingDecision,
                      isInteractive,
                      playerId,
                    )}
                    disabled={isHandCardDisabled(
                      card,
                      isInteractive,
                      isActive,
                      pendingDecision,
                      playerId,
                      phase,
                      actions,
                    )}
                  />
                </div>
              );
            })}
      </div>
    </div>
  );
}
