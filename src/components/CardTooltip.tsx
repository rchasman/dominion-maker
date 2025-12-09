import type { CardName } from "../types/game-state";
import { getCardImageUrl } from "../data/cards";
import { createPortal } from "react-dom";

interface CardTooltipProps {
  cardName: CardName;
  mouseX: number;
  mouseY: number;
  showBack?: boolean;
}

export function CardTooltip({
  cardName,
  mouseX,
  mouseY,
  showBack,
}: CardTooltipProps) {
  const imageUrl = showBack
    ? "/cards/Card_back.jpg"
    : getCardImageUrl(cardName);

  const fallbackUrl = showBack
    ? "https://wiki.dominionstrategy.com/images/c/ca/Card_back.jpg"
    : `https://robinzigmond.github.io/Dominion-app/images/card_images/${cardName.replace(/ /g, "_")}.jpg`;

  const tooltipWidth = 180;
  const tooltipHeight = 280;

  const viewportWidth = window.innerWidth;

  // Position so cursor is at bottom-right, but skewed inward and upward (like gripping it)
  const offsetX = 30; // Move cursor inward from right edge
  const offsetY = 34; // Move cursor up from bottom edge

  let left = mouseX - tooltipWidth + offsetX;
  let top = mouseY - tooltipHeight + offsetY;

  // Keep within viewport horizontally
  if (left < 0) {
    left = 0;
  } else if (left + tooltipWidth > viewportWidth) {
    left = viewportWidth - tooltipWidth;
  }

  // Keep within viewport vertically
  if (top < 0) {
    top = 0;
  } else if (top + tooltipHeight > window.innerHeight) {
    top = window.innerHeight - tooltipHeight;
  }

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
          background: "rgba(0, 0, 0, 0.7)",
          border: "2px solid var(--color-border)",
          borderRadius: "8px",
          padding: "0.5rem",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <img
          src={imageUrl}
          alt={showBack ? "Card back" : cardName}
          style={{
            width: "180px",
            height: "auto",
            display: "block",
            borderRadius: "4px",
          }}
          onError={e => {
            const img = e.target as HTMLImageElement;
            if (img.src !== fallbackUrl) {
              img.src = fallbackUrl;
            }
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
