import type { CardName } from "../types/game-state";
import { getCardImageUrl } from "../data/cards";

interface CardTooltipProps {
  cardName: CardName;
  mouseX: number;
  mouseY: number;
  showBack?: boolean;
}

export function CardTooltip({ cardName, mouseX, mouseY, showBack }: CardTooltipProps) {
  const imageUrl = showBack
    ? "/cards/Card_back.jpg"
    : getCardImageUrl(cardName);

  const fallbackUrl = showBack
    ? "https://wiki.dominionstrategy.com/images/c/ca/Card_back.jpg"
    : `https://robinzigmond.github.io/Dominion-app/images/card_images/${cardName.replace(/ /g, "_")}.jpg`;

  const tooltipWidth = 240;
  const tooltipHeight = 374;
  const offsetX = 12;
  const offsetY = 12;

  const viewportWidth = window.innerWidth;

  let left = mouseX + offsetX;
  let top = mouseY - offsetY - tooltipHeight;

  if (left + tooltipWidth > viewportWidth) {
    left = mouseX - offsetX - tooltipWidth;
  }

  if (top < 0) {
    top = mouseY + offsetY;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        pointerEvents: "none",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: "rgba(0, 0, 0, 0.95)",
          border: "2px solid var(--color-border)",
          borderRadius: "8px",
          padding: "0.5rem",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
        }}
      >
        <img
          src={imageUrl}
          alt={showBack ? "Card back" : cardName}
          style={{
            width: "240px",
            height: "auto",
            display: "block",
            borderRadius: "4px",
          }}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.src !== fallbackUrl) {
              img.src = fallbackUrl;
            }
          }}
        />
      </div>
    </div>
  );
}
