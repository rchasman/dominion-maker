import type { CardName } from "../types/game-state";
import { getCardImageUrl } from "../data/cards";
import { createPortal } from "react-dom";

interface PileTooltipProps {
  cards: CardName[];
  knownCards?: CardName[]; // For deck: cards that are known/revealed
  mouseX: number;
  mouseY: number;
  pileType?: "deck" | "discard" | "trash";
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
  const tooltipHeight = Math.min(500, uniqueCards.length * 80 + 100);

  const viewportWidth = window.innerWidth;

  // Center on cursor
  let left = mouseX - tooltipWidth / 2;
  let top = mouseY - tooltipHeight / 2;

  // Keep within viewport
  if (left < 0) {
    left = 0;
  } else if (left + tooltipWidth > viewportWidth) {
    left = viewportWidth - tooltipWidth;
  }

  if (top < 0) {
    top = 0;
  } else if (top + tooltipHeight > window.innerHeight) {
    top = window.innerHeight - tooltipHeight;
  }

  const borderColor =
    pileType === "trash"
      ? "#ef4444"
      : pileType === "discard"
        ? "#fbbf24"
        : "#60a5fa";

  const titleText =
    pileType === "deck" ? "Deck" : pileType === "discard" ? "Discard" : "Trash";

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

        {/* For deck with known cards, show them separately */}
        {pileType === "deck" && knownUniqueCards.length > 0 && (
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
                return (
                  <div
                    key={card}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <img
                      src={getCardImageUrl(card)}
                      alt={card}
                      style={{
                        width: "var(--card-width-medium)",
                        height: "auto",
                        border: "1px solid var(--color-border)",
                      }}
                      onError={e => {
                        const img = e.target as HTMLImageElement;
                        const fallbackUrl = `https://robinzigmond.github.io/Dominion-app/images/card_images/${card.replace(/ /g, "_")}.jpg`;
                        if (img.src !== fallbackUrl) {
                          img.src = fallbackUrl;
                        }
                      }}
                    />
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
        )}

        {/* Show all cards (or just unknown for deck with known cards) */}
        {((pileType === "deck" && knownUniqueCards.length === 0) ||
          pileType !== "deck") && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              paddingTop: "0.75rem",
            }}
          >
            {uniqueCards.map(card => (
              <div
                key={card}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <img
                  src={getCardImageUrl(card)}
                  alt={card}
                  style={{
                    width: "var(--card-width-medium)",
                    height: "auto",
                    border: "1px solid var(--color-border)",
                  }}
                  onError={e => {
                    const img = e.target as HTMLImageElement;
                    const fallbackUrl = `https://robinzigmond.github.io/Dominion-app/images/card_images/${card.replace(/ /g, "_")}.jpg`;
                    if (img.src !== fallbackUrl) {
                      img.src = fallbackUrl;
                    }
                  }}
                />
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  ×{cardCounts[card]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
