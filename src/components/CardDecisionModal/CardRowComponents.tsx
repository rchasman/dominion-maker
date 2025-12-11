import type { CardAction } from "../../types/game-state";

export interface ActionIndicatorProps {
  action: CardAction | undefined;
  needsOrdering: boolean;
  cardsToOrder: number[];
  cardIndex: number;
}

export interface ReorderButtonsProps {
  cardIndex: number;
  cardsToOrder: number[];
  cardOrder: number[];
  onReorder: (newOrder: number[]) => void;
}

function swapInOrder(
  cardOrder: number[],
  idx1: number,
  idx2: number,
): number[] {
  const newOrder = [...cardOrder];
  [newOrder[idx1], newOrder[idx2]] = [newOrder[idx2], newOrder[idx1]];
  return newOrder;
}

export function ActionIndicator({
  action,
  needsOrdering,
  cardsToOrder,
  cardIndex,
}: ActionIndicatorProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: "-8px",
        right: "-8px",
        background: action?.color || "#666",
        color: "white",
        padding: "4px 8px",
        borderRadius: "12px",
        fontSize: "0.75rem",
        fontWeight: 600,
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        pointerEvents: "none",
      }}
    >
      {action?.label}
      {(action?.id === "topdeck" || action?.id === "keep") &&
        needsOrdering &&
        ` #${cardsToOrder.indexOf(cardIndex) + 1}`}
    </div>
  );
}

export function ReorderButtons({
  cardIndex,
  cardsToOrder,
  cardOrder,
  onReorder,
}: ReorderButtonsProps) {
  const handleMoveUp = () => {
    const currentPos = cardsToOrder.indexOf(cardIndex);
    if (currentPos > 0) {
      const idx1 = cardOrder.indexOf(cardsToOrder[currentPos]);
      const idx2 = cardOrder.indexOf(cardsToOrder[currentPos - 1]);
      onReorder(swapInOrder(cardOrder, idx1, idx2));
    }
  };

  const handleMoveDown = () => {
    const currentPos = cardsToOrder.indexOf(cardIndex);
    if (currentPos < cardsToOrder.length - 1) {
      const idx1 = cardOrder.indexOf(cardsToOrder[currentPos]);
      const idx2 = cardOrder.indexOf(cardsToOrder[currentPos + 1]);
      onReorder(swapInOrder(cardOrder, idx1, idx2));
    }
  };

  const buttonStyle = {
    background: "rgba(0, 0, 0, 0.7)",
    border: "1px solid white",
    borderRadius: "3px",
    color: "white" as const,
    cursor: "pointer" as const,
    padding: "2px 6px",
    fontSize: "0.75rem",
    lineHeight: 1,
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "-12px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "4px",
        pointerEvents: "auto",
      }}
    >
      <button
        onClick={e => {
          e.stopPropagation();
          handleMoveUp();
        }}
        style={buttonStyle}
      >
        ◀
      </button>
      <button
        onClick={e => {
          e.stopPropagation();
          handleMoveDown();
        }}
        style={buttonStyle}
      >
        ▶
      </button>
    </div>
  );
}
