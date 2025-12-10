import type { CardName } from "../types/game-state";
import { getCardImageUrl } from "../data/cards";
import { createPortal } from "react-dom";
import type { ReactPortal, ReactNode } from "react";
import { run } from "../lib/run";

interface CardTooltipProps {
  cardName: CardName;
  mouseX: number;
  mouseY: number;
  showBack?: boolean;
}

function createTooltipPortal(element: ReactNode): ReactPortal {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  return createPortal(element, document.body) as ReactPortal;
}

export function CardTooltip({
  cardName,
  mouseX,
  mouseY,
  showBack,
}: CardTooltipProps): ReactPortal {
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

  const rawLeft = mouseX - tooltipWidth + offsetX;
  const rawTop = mouseY - tooltipHeight + offsetY;

  // Keep within viewport horizontally
  const left = run(() => {
    if (rawLeft < 0) return 0;
    if (rawLeft + tooltipWidth > viewportWidth)
      return viewportWidth - tooltipWidth;
    return rawLeft;
  });

  // Keep within viewport vertically
  const top = run(() => {
    if (rawTop < 0) return 0;
    if (rawTop + tooltipHeight > window.innerHeight)
      return window.innerHeight - tooltipHeight;
    return rawTop;
  });

  return createTooltipPortal(
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
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
            const img = e.currentTarget;
            if (img.src !== fallbackUrl) {
              img.src = fallbackUrl;
            }
          }}
        />
      </div>
    </div>,
  );
}
