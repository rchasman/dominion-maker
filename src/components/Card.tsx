import { useState, useRef } from "preact/hooks";
import { lazy } from "preact/compat";
import type { CardName } from "../types/game-state";
import { getCardImageUrl, getCardImageFallbackUrl } from "../data/cards";
import { isTooltipActive, setTooltipActive } from "../lib/tooltip-state";
import { run } from "../lib/run";
import {
  getOptimizedImageUrl,
  generateSrcSet,
  CARD_WIDTHS,
} from "../lib/image-optimization";

// Lazy load tooltip - only shown on hover
const CardTooltip = lazy(() =>
  import("./CardTooltip").then(m => ({ default: m.CardTooltip })),
);

const TOOLTIP_DELAY_MS = 500;
const OPACITY_DISABLED = 0.4;
const OPACITY_DIMMED = 0.5;

interface CardProps {
  name: CardName;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  count?: number;
  showBack?: boolean;
  size?: "small" | "medium" | "large";
  highlightMode?: "trash" | "discard" | "gain";
  disableTooltip?: boolean;
  cardId?: string;
  priority?: boolean;
}

function getBorderStyle(
  selected: boolean | undefined,
  highlightMode: "trash" | "discard" | "gain" | undefined,
): { border: string; boxShadow: string } {
  if (selected) {
    return {
      border: "0.125rem solid var(--color-victory)",
      boxShadow: "var(--shadow-md)",
    };
  }
  if (highlightMode === "trash") {
    return {
      border: "0.1875rem dashed #ef4444",
      boxShadow: "0 0 0.5rem rgba(239, 68, 68, 0.4)",
    };
  }
  if (highlightMode === "discard") {
    return {
      border: "0.1875rem dashed #f59e0b",
      boxShadow: "0 0 0.5rem rgba(245, 158, 11, 0.4)",
    };
  }
  if (highlightMode === "gain") {
    return {
      border: "0.1875rem dashed #10b981",
      boxShadow: "0 0 0.5rem rgba(16, 185, 129, 0.4)",
    };
  }
  return {
    border: "0.125rem solid transparent",
    boxShadow: "none",
  };
}

function getCardWidth(size: "small" | "medium" | "large"): string {
  if (size === "small") {
    return "var(--card-width-small)";
  }
  if (size === "large") {
    return "var(--card-width-large)";
  }
  return "var(--card-width-medium)";
}

function renderCardImage(params: {
  imageUrl: string;
  fallbackUrl: string;
  showBack: boolean;
  name: string;
  cardWidth: string;
  size: "small" | "medium" | "large";
  priority?: boolean;
}) {
  const { imageUrl, fallbackUrl, showBack, name, cardWidth, size, priority } =
    params;

  // Generate responsive srcset with Vercel optimization
  const widths = CARD_WIDTHS[size];
  const webpSrcSet = generateSrcSet(imageUrl, widths);
  const jpgSrcSet = generateSrcSet(fallbackUrl, widths);
  const optimizedSrc = getOptimizedImageUrl({
    url: imageUrl,
    width: widths[1], // Use middle width as default
  });

  return (
    <picture>
      <source type="image/webp" srcSet={webpSrcSet} sizes={cardWidth} />
      <source type="image/jpeg" srcSet={jpgSrcSet} sizes={cardWidth} />
      <img
        src={optimizedSrc}
        alt={showBack ? "Card back" : name}
        width="200"
        height="320"
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchpriority={priority ? "high" : undefined}
        style={{
          maxInlineSize: cardWidth,
          inlineSize: "100%",
          blockSize: "auto",
          display: "block",
          objectFit: "contain",
        }}
      />
    </picture>
  );
}

function renderCardCount(count: number | undefined) {
  if (count === undefined) return null;

  return (
    <div
      style={{
        position: "absolute",
        insetBlockStart: "-0.5rem",
        insetInlineEnd: "-0.5rem",
        background: count === 0 ? "#666" : "rgba(0, 0, 0, 0.85)",
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
      {count}
    </div>
  );
}

export function Card({
  name,
  onClick,
  selected,
  disabled,
  dimmed,
  count,
  showBack,
  size = "medium",
  highlightMode,
  disableTooltip = false,
  cardId,
  priority = false,
}: CardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageUrl = showBack ? "/cards/Card_back.webp" : getCardImageUrl(name);
  const fallbackUrl = showBack
    ? "/cards/Card_back.jpg"
    : getCardImageFallbackUrl(name);
  const cardWidth = getCardWidth(size);

  const handleMouseEnter = () => {
    if (disableTooltip) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (isTooltipActive()) {
      setShowTooltip(true);
      setTooltipActive(true);
    } else {
      timeoutRef.current = setTimeout(() => {
        setShowTooltip(true);
        setTooltipActive(true);
      }, TOOLTIP_DELAY_MS);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowTooltip(false);
    setTooltipActive(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleClick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (showTooltip) {
      setShowTooltip(false);
      setTooltipActive(false);
    }
    if (!disabled && onClick) {
      onClick();
    }
  };

  const cursor = run(() => {
    if (!onClick) return "default";
    if (disabled) return "not-allowed";
    return "pointer";
  });

  const opacity: number = run(() => {
    if (disabled) return OPACITY_DISABLED;
    if (dimmed) return OPACITY_DIMMED;
    return 1;
  });

  const transform = selected ? "translateY(calc(-1 * var(--space-2)))" : "none";
  const borderStyle = getBorderStyle(selected, highlightMode);

  return (
    <>
      <div
        data-card-id={cardId}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        style={{
          position: "relative",
          cursor,
          opacity,
          transform,
          transition:
            "transform var(--transition-fast), box-shadow var(--transition-fast)",
          border: borderStyle.border,
          boxShadow: borderStyle.boxShadow,
          minInlineSize: 0,
          flexShrink: 1,
          userSelect: "none",
        }}
      >
        {renderCardImage({
          imageUrl,
          fallbackUrl,
          showBack,
          name,
          cardWidth,
          size,
          priority,
        })}
        {renderCardCount(count)}
      </div>
      {showTooltip && (
        <CardTooltip
          cardName={name}
          mouseX={mousePosition.x}
          mouseY={mousePosition.y}
          showBack={showBack}
        />
      )}
    </>
  );
}
