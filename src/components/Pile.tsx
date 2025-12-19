import { useState } from "preact/hooks";
import { lazy, Suspense } from "preact/compat";
import type { CardName } from "../types/game-state";
import { Card } from "./Card";

// Lazy load tooltip - only shown on hover
const PileTooltip = lazy(() =>
  import("./PileTooltip").then(m => ({ default: m.PileTooltip })),
);

interface PileProps {
  cards: CardName[];
  pileType: "deck" | "discard" | "trash";
  knownCards?: CardName[];
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  showBack?: boolean;
}

function EmptyPile() {
  return (
    <div
      style={{
        width: "var(--card-width-small)",
        aspectRatio: "5 / 7.8",
        border: "1px dashed var(--color-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-text-muted)",
        fontSize: "0.5625rem",
        background: "var(--color-bg-primary)",
      }}
    >
      Empty
    </div>
  );
}

export function Pile({
  cards,
  pileType,
  knownCards,
  size = "small",
  disabled = true,
  showBack = false,
}: PileProps) {
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  if (cards.length === 0) {
    return <EmptyPile />;
  }

  return (
    <>
      <div
        style={{ position: "relative" }}
        onMouseEnter={e => {
          setTooltipPosition({ x: e.clientX, y: e.clientY });
        }}
        onMouseMove={e => {
          setTooltipPosition({ x: e.clientX, y: e.clientY });
        }}
        onMouseLeave={() => setTooltipPosition(null)}
      >
        <Card
          name={cards[cards.length - 1]}
          size={size}
          disabled={disabled}
          disableTooltip={true}
          showBack={showBack}
        />
        <div
          style={{
            position: "absolute",
            insetBlockStart: "-0.5rem",
            insetInlineEnd: "-0.5rem",
            background: cards.length === 0 ? "#666" : "rgba(0, 0, 0, 0.85)",
            color: "white",
            minInlineSize: "1.75rem",
            blockSize: "1.75rem",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.875rem",
            fontWeight: "bold",
            border: "0.125rem solid rgba(255, 255, 255, 0.3)",
            boxShadow: "0 0.125rem 0.25rem rgba(0,0,0,0.3)",
          }}
        >
          {cards.length}
        </div>
      </div>

      {tooltipPosition && (
        <Suspense fallback={null}>
          <PileTooltip
            cards={cards}
            {...(knownCards !== undefined && { knownCards })}
            mouseX={tooltipPosition.x}
            mouseY={tooltipPosition.y}
            {...(pileType !== undefined && { pileType })}
          />
        </Suspense>
      )}
    </>
  );
}
