import { useState, useRef } from "react";
import type { CardName } from "../types/game-state";
import { getCardImageUrl } from "../data/cards";
import { CardTooltip } from "./CardTooltip";
import { isTooltipActive, setTooltipActive } from "../lib/tooltip-state";

interface CardProps {
  name: CardName;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  count?: number;
  showBack?: boolean;
  size?: "small" | "medium" | "large";
  highlightMode?: "trash" | "discard" | "gain";
}

export function Card({
  name,
  onClick,
  selected,
  disabled,
  count,
  showBack,
  size = "medium",
  highlightMode,
}: CardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imageUrl = showBack ? "/cards/Card_back.jpg" : getCardImageUrl(name);

  const fallbackUrl = showBack
    ? "https://wiki.dominionstrategy.com/images/c/ca/Card_back.jpg"
    : `https://robinzigmond.github.io/Dominion-app/images/card_images/${name.replace(/ /g, "_")}.jpg`;

  // Determine border style based on state
  const getBorderStyle = () => {
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
  };

  const borderStyle = getBorderStyle();

  const handleMouseEnter = () => {
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
      }, 500);
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

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        onClick={disabled ? undefined : onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        style={{
          position: "relative",
          cursor:
            onClick && !disabled
              ? "pointer"
              : onClick && disabled
                ? "not-allowed"
                : "default",
          opacity: disabled ? 0.4 : 1,
          transform: selected
            ? "translateY(calc(-1 * var(--space-2)))"
            : "none",
          transition:
            "transform var(--transition-fast), box-shadow var(--transition-fast)",
          ...borderStyle,
          minInlineSize: 0,
          flexShrink: 1,
          userSelect: "none",
        }}
      >
        <img
          src={imageUrl}
          alt={showBack ? "Card back" : name}
          style={{
            maxInlineSize:
              size === "small"
                ? "var(--card-width-small)"
                : size === "large"
                  ? "var(--card-width-large)"
                  : "var(--card-width-medium)",
            inlineSize: "100%",
            blockSize: "auto",
            display: "block",
            objectFit: "contain",
          }}
          onError={e => {
            const img = e.target as HTMLImageElement;
            if (img.src !== fallbackUrl) {
              img.src = fallbackUrl;
            } else {
              img.style.display = "none";
            }
          }}
        />
        {count !== undefined && (
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
        )}
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
