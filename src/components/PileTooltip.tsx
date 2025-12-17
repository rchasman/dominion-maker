import type { CardName } from "../types/game-state";
import { getCardImageUrl, getCardImageFallbackUrl } from "../data/cards";
import { run } from "../lib/run";
import { createPortal } from "preact/compat";
import {
  getOptimizedImageUrl,
  generateSrcSet,
} from "../lib/image-optimization";

const MAX_TOOLTIP_HEIGHT = 500;
const CARD_HEIGHT_ESTIMATE = 80;
const TOOLTIP_PADDING = 100;

interface PileTooltipProps {
  cards: CardName[];
  knownCards?: CardName[];
  mouseX: number;
  mouseY: number;
  pileType?: "deck" | "discard" | "trash";
}

interface TooltipPosition {
  left: number;
  top: number;
}

function getBorderColor(pileType?: string): string {
  if (pileType === "trash") {
    return "#ef4444";
  }
  if (pileType === "discard") {
    return "#fbbf24";
  }
  return "#60a5fa";
}

function getTitleText(pileType?: string): string {
  if (pileType === "deck") {
    return "Deck";
  }
  if (pileType === "discard") {
    return "Discard";
  }
  return "Trash";
}

function calculatePosition(
  mouseX: number,
  mouseY: number,
  tooltipWidth: number,
  tooltipHeight: number,
): TooltipPosition {
  const viewportWidth = window.innerWidth;

  const left = run(() => {
    if (mouseX < 0) return 0;
    if (mouseX + tooltipWidth > viewportWidth)
      return viewportWidth - tooltipWidth;
    return mouseX;
  });

  const top = run(() => {
    if (mouseY < 0) return 0;
    if (mouseY + tooltipHeight > window.innerHeight)
      return window.innerHeight - tooltipHeight;
    return mouseY;
  });

  return { left, top };
}

function CardImage({
  card,
  count,
}: {
  card: CardName;
  count: number;
}): JSX.Element {
  const imageUrl = getCardImageUrl(card);
  const fallbackUrl = getCardImageFallbackUrl(card);

  return (
    <div
      key={card}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <picture>
        <source
          type="image/webp"
          srcSet={generateSrcSet(imageUrl, [200, 300, 400])}
          sizes="var(--card-width-medium)"
        />
        <source
          type="image/jpeg"
          srcSet={generateSrcSet(fallbackUrl, [200, 300, 400])}
          sizes="var(--card-width-medium)"
        />
        <img
          src={getOptimizedImageUrl({ url: imageUrl, width: 300 })}
          alt={card}
          style={{
            width: "var(--card-width-medium)",
            height: "auto",
            border: "1px solid var(--color-border)",
          }}
        />
      </picture>
      <span
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--color-text-secondary)",
        }}
      >
        ×{count}
      </span>
    </div>
  );
}

function KnownCardsSection({
  knownUniqueCards,
  knownCards,
  unknownCards,
}: {
  knownUniqueCards: CardName[];
  knownCards: CardName[];
  unknownCards: CardName[];
}): JSX.Element {
  return (
    <>
      <div
        style={{
          fontSize: "0.625rem",
          color: "var(--color-text-secondary)",
          fontWeight: 600,
          textTransform: "uppercase",
          marginBottom: "0.5rem",
          paddingTop: "0.75rem",
        }}
      >
        Known Cards
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "1rem",
        }}
      >
        {knownUniqueCards.map(card => {
          const count = knownCards.filter(c => c === card).length;
          return <CardImage key={card} card={card} count={count} />;
        })}
      </div>
      {unknownCards.length > 0 && (
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-text-secondary)",
            fontWeight: 600,
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          Unknown Cards ({unknownCards.length})
        </div>
      )}
    </>
  );
}

function AllCardsSection({
  uniqueCards,
  cardCounts,
}: {
  uniqueCards: CardName[];
  cardCounts: Record<CardName, number>;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        paddingTop: "0.75rem",
      }}
    >
      {uniqueCards.map(card => {
        const count = cardCounts[card];
        return <CardImage key={card} card={card} count={count ?? 0} />;
      })}
    </div>
  );
}

interface TooltipContentProps {
  pileType?: string;
  knownUniqueCards: CardName[];
  knownCards: CardName[];
  unknownCards: CardName[];
  uniqueCards: CardName[];
  cardCounts: Record<CardName, number>;
  borderColor: string;
  titleText: string;
}

function TooltipContent({
  pileType,
  knownUniqueCards,
  knownCards,
  unknownCards,
  uniqueCards,
  cardCounts,
  borderColor,
  titleText,
}: TooltipContentProps): JSX.Element {
  const showDeckCards = pileType === "deck" && knownUniqueCards.length > 0;
  const showAllCards =
    (pileType === "deck" && knownUniqueCards.length === 0) ||
    pileType !== "deck";

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "var(--space-2)",
          left: "var(--space-2)",
          fontSize: "0.625rem",
          color: borderColor,
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {titleText}
      </div>
      {showDeckCards && (
        <KnownCardsSection
          knownUniqueCards={knownUniqueCards}
          knownCards={knownCards}
          unknownCards={unknownCards}
        />
      )}
      {showAllCards && (
        <AllCardsSection uniqueCards={uniqueCards} cardCounts={cardCounts} />
      )}
    </>
  );
}

export function PileTooltip({
  cards,
  knownCards = [],
  mouseX,
  mouseY,
  pileType,
}: PileTooltipProps) {
  if (cards.length === 0) return null;

  // Group cards by name and count
  const cardCounts = cards.reduce(
    (acc, card) => {
      acc[card] = (acc[card] || 0) + 1;
      return acc;
    },
    {} as Record<CardName, number>,
  );

  const uniqueCards = Object.keys(cardCounts) as CardName[];

  // For deck: separate known vs unknown cards
  const knownSet = new Set(knownCards);
  const knownUniqueCards = uniqueCards.filter(card => knownSet.has(card));
  const unknownCards = cards.filter(card => !knownSet.has(card));

  const tooltipWidth = 320;
  const tooltipHeight = Math.min(
    MAX_TOOLTIP_HEIGHT,
    uniqueCards.length * CARD_HEIGHT_ESTIMATE + TOOLTIP_PADDING,
  );

  const { left, top } = calculatePosition(
    mouseX,
    mouseY,
    tooltipWidth,
    tooltipHeight,
  );

  const borderColor = getBorderColor(pileType);
  const titleText = getTitleText(pileType);

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        pointerEvents: "none",
        zIndex: 10000,
        animation: "boing 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
      }}
    >
      <div
        style={{
          background: "rgba(26, 26, 46, 0.75)",
          backdropFilter: "blur(12px)",
          border: `2px solid ${borderColor}`,
          padding: "1rem",
          maxWidth: `${tooltipWidth}px`,
          maxHeight: `${tooltipHeight}px`,
          overflow: "auto",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          position: "relative",
        }}
      >
        <TooltipContent
          pileType={pileType}
          knownUniqueCards={knownUniqueCards}
          knownCards={knownCards}
          unknownCards={unknownCards}
          uniqueCards={uniqueCards}
          cardCounts={cardCounts}
          borderColor={borderColor}
          titleText={titleText}
        />
      </div>
    </div>,
    document.body,
  );
}
