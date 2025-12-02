import type { CardName } from "../types/game-state";
import { getCardImageUrl, CARDS } from "../data/cards";

interface CardProps {
  name: CardName;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  count?: number;
  showBack?: boolean;
  size?: "small" | "medium";
}

const SIZES = {
  small: { width: 60, height: 95 },
  medium: { width: 80, height: 125 },
};

export function Card({
  name,
  onClick,
  selected,
  disabled,
  count,
  showBack,
  size = "medium",
}: CardProps) {
  const imageUrl = showBack
    ? "https://robinzigmond.github.io/Dominion-app/images/card_images/Card_back.jpg"
    : getCardImageUrl(name);

  const { width } = SIZES[size];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        position: "relative",
        cursor: onClick && !disabled ? "pointer" : "default",
        opacity: disabled ? 0.5 : 1,
        transform: selected ? "translateY(-8px)" : "none",
        transition: "transform 0.1s",
        border: selected ? "2px solid #4CAF50" : "2px solid transparent",
        borderRadius: "4px",
        flexShrink: 0,
      }}
    >
      <img
        src={imageUrl}
        alt={showBack ? "Card back" : name}
        style={{
          width: `${width}px`,
          height: "auto",
          borderRadius: "3px",
          display: "block",
        }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {count !== undefined && (
        <div
          style={{
            position: "absolute",
            top: "-6px",
            right: "-6px",
            background: count === 0 ? "#999" : "#333",
            color: "white",
            minWidth: "18px",
            height: "18px",
            borderRadius: "9px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: "bold",
            padding: "0 4px",
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}
