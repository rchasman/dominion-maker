import { useEffect, useRef } from "preact/hooks";
import type { CardName, Phase, PlayerId } from "../../types/game-state";
import type { PendingChoice } from "../../events/types";
import { Card } from "../Card";
import { CARDS } from "../../data/cards";
import { useAnimationSafe } from "../../animation";

const PLACEHOLDER_HAND_SIZE = 5;

interface HandSectionProps {
  hand: CardName[];
  showCards: boolean;
  loading: boolean;
  selectedCardIndices: number[];
  pendingChoice?: Extract<PendingChoice, { choiceType: "decision" }> | null;
  isInteractive: boolean;
  isActive: boolean;
  playerId?: PlayerId;
  phase: Phase;
  actions?: number;
  onCardClick?: (card: CardName, index: number) => void;
  inverted?: boolean;
}

function getHandCardHighlightMode(
  card: CardName,
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined,
  isInteractive: boolean,
  playerId: PlayerId | undefined,
): "trash" | "discard" | "gain" | undefined {
  if (!pendingChoice || !isInteractive) return undefined;
  if (pendingChoice.player !== playerId) return undefined;
  if (pendingChoice.from !== "hand") return undefined;

  const isSelectable = pendingChoice.cardOptions?.includes(card) ?? true;
  if (!isSelectable) return undefined;

  if (pendingChoice.stage === "trash") return "trash";
  if (pendingChoice.stage === "discard") return "discard";

  return undefined;
}

interface CardDisabledContext {
  card: CardName;
  isInteractive: boolean;
  isActive: boolean;
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  playerId: PlayerId | undefined;
  phase: Phase;
  actions: number | undefined;
}

function isHandCardDisabled(context: CardDisabledContext): boolean {
  const {
    card,
    isInteractive,
    isActive,
    pendingChoice,
    playerId,
    phase,
    actions,
  } = context;

  if (!isInteractive) return true;
  if (!isActive) return true;

  if (
    pendingChoice &&
    pendingChoice.player === playerId &&
    pendingChoice.from === "hand"
  ) {
    const cardOptions = pendingChoice.cardOptions ?? [];
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
  pendingChoice,
  isInteractive,
  isActive,
  playerId,
  phase,
  actions,
  onCardClick,
  inverted,
}: {
  card: CardName;
  index: number;
  selectedCardIndices: number[];
  pendingChoice:
    | Extract<PendingChoice, { choiceType: "decision" }>
    | null
    | undefined;
  isInteractive: boolean;
  isActive: boolean;
  playerId: string | undefined;
  phase: Phase;
  actions: number | undefined;
  onCardClick?: (card: CardName, index: number) => void;
  inverted: boolean;
}) {
  const isSelected =
    (!pendingChoice ||
      pendingChoice.from === "hand" ||
      pendingChoice.from === "discard") &&
    selectedCardIndices.includes(index);

  const cardIdPrefix = inverted ? "hand-opponent" : "hand";

  return (
    <div key={`${card}-${index}-wrapper`}>
      <Card
        key={`${card}-${index}`}
        name={card}
        size="large"
        cardId={`${cardIdPrefix}-${index}-${card}`}
        onClick={() => onCardClick?.(card, index)}
        selected={isSelected}
        highlightMode={getHandCardHighlightMode(
          card,
          pendingChoice,
          isInteractive,
          playerId,
        )}
        disabled={isHandCardDisabled({
          card,
          isInteractive,
          isActive,
          pendingChoice,
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
  pendingChoice,
  isInteractive,
  isActive,
  playerId,
  phase,
  actions,
  onCardClick,
  inverted = false,
}: HandSectionProps) {
  const animation = useAnimationSafe();
  const containerRef = useRef<HTMLDivElement>(null);

  // Register with player-specific zone name
  useEffect(() => {
    if (animation && containerRef.current) {
      const zoneName = inverted ? "hand-opponent" : "hand";
      animation.registerZoneRef(zoneName, containerRef.current);
      return () => animation.registerZoneRef(zoneName, null);
    }
  }, [animation, inverted]);

  if (!showCards) {
    return <HandCountDisplay handLength={hand.length} />;
  }

  return (
    <div
      ref={containerRef}
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
                pendingChoice={pendingChoice}
                isInteractive={isInteractive}
                isActive={isActive}
                playerId={playerId}
                phase={phase}
                actions={actions}
                onCardClick={onCardClick}
                inverted={inverted}
              />
            ))}
      </div>
    </div>
  );
}
