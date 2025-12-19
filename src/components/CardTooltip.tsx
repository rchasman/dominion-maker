import type { CardName } from "../types/game-state";
import { getCardImageUrl, getCardImageFallbackUrl } from "../data/card-urls";
import { run } from "../lib/run";
import { createPortal } from "preact/compat";
import {
  getOptimizedImageUrl,
  generateSrcSet,
} from "../lib/image-optimization";

const TOOLTIP_DIMENSIONS = {
  WIDTH_PX: 216,
  HEIGHT_PX: 336,
} as const;

const TOOLTIP_OFFSET = {
  X_PX: 30,
  Y_PX: 34,
} as const;

const IMAGE_WIDTHS = {
  SRCSET_SIZES: [200, 320, 400],
  OPTIMIZED_WIDTH: 300,
} as const;

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
    ? "/cards/Card_back.webp"
    : getCardImageUrl(cardName);
  const fallbackUrl = showBack
    ? "/cards/Card_back.jpg"
    : getCardImageFallbackUrl(cardName);

  const tooltipWidth = TOOLTIP_DIMENSIONS.WIDTH_PX;
  const tooltipHeight = TOOLTIP_DIMENSIONS.HEIGHT_PX;

  const viewportWidth = window.innerWidth;

  // Position so cursor is at bottom-right, but skewed inward and upward (like gripping it)
  const offsetX = TOOLTIP_OFFSET.X_PX;
  const offsetY = TOOLTIP_OFFSET.Y_PX;

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

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        pointerEvents: "none",
        zIndex: TOOLTIP_DIMENSIONS.WIDTH_PX,
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
        <picture>
          <source
            type="image/webp"
            srcSet={generateSrcSet(imageUrl, IMAGE_WIDTHS.SRCSET_SIZES)}
            sizes={`${TOOLTIP_DIMENSIONS.WIDTH_PX}px`}
          />
          <source
            type="image/jpeg"
            srcSet={generateSrcSet(fallbackUrl, IMAGE_WIDTHS.SRCSET_SIZES)}
            sizes={`${TOOLTIP_DIMENSIONS.WIDTH_PX}px`}
          />
          <img
            src={getOptimizedImageUrl({
              url: imageUrl,
              width: IMAGE_WIDTHS.OPTIMIZED_WIDTH,
            })}
            alt={showBack ? "Card back" : cardName}
            width={`${TOOLTIP_DIMENSIONS.WIDTH_PX}`}
            height="346"
            style={{
              width: `${TOOLTIP_DIMENSIONS.WIDTH_PX}px`,
              height: "auto",
              display: "block",
              borderRadius: "4px",
            }}
          />
        </picture>
      </div>
    </div>,
    document.body,
  );
}
