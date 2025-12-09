import { useState, useCallback, useEffect } from "react";
import type { CardName, CardAction } from "../types/game-state";
import { Card } from "./Card";

interface CardDecisionModalProps {
  cards: CardName[];
  actions: CardAction[];
  requiresOrdering?: boolean;
  onDataChange: (data: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void;
}

export function CardDecisionModal({
  cards,
  actions,
  requiresOrdering = false,
  onDataChange,
}: CardDecisionModalProps) {
  const defaultAction = actions.find(a => a.isDefault);

  // Initialize all cards with default action - use index as key
  const [cardActions, setCardActions] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    cards.forEach((_, index) => {
      initial[index] = defaultAction?.id || actions[0].id;
    });
    return initial;
  });

  const [cardOrder, setCardOrder] = useState<number[]>(cards.map((_, i) => i));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Notify parent of initial state on mount
  useEffect(() => {
    const cardsToOrder = cardOrder.filter(idx => {
      const action = cardActions[idx];
      return action === "topdeck" || action === "keep";
    });
    onDataChange({
      cardActions,
      cardOrder: requiresOrdering ? cardsToOrder : undefined,
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCardAction = useCallback(
    (index: number) => {
      setCardActions(prev => {
        const currentActionIndex = actions.findIndex(a => a.id === prev[index]);
        const nextActionIndex = (currentActionIndex + 1) % actions.length;
        const newCardActions = {
          ...prev,
          [index]: actions[nextActionIndex].id,
        };

        // Notify parent immediately
        const cardsToOrder = cardOrder.filter(idx => {
          const action = newCardActions[idx];
          return action === "topdeck" || action === "keep";
        });
        onDataChange({
          cardActions: newCardActions,
          cardOrder: requiresOrdering ? cardsToOrder : undefined,
        });

        return newCardActions;
      });
    },
    [actions, cardOrder, onDataChange, requiresOrdering],
  );

  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (draggedIndex === null || draggedIndex === targetIndex) return;

      setCardOrder(prev => {
        const newOrder = [...prev];
        const draggedOrderIndex = newOrder.indexOf(draggedIndex);
        const targetOrderIndex = newOrder.indexOf(targetIndex);

        // Remove dragged card and insert at target position
        newOrder.splice(draggedOrderIndex, 1);
        newOrder.splice(targetOrderIndex, 0, draggedIndex);

        // Notify parent immediately
        const cardsToOrder = newOrder.filter(idx => {
          const action = cardActions[idx];
          return action === "topdeck" || action === "keep";
        });
        onDataChange({
          cardActions,
          cardOrder: requiresOrdering ? cardsToOrder : undefined,
        });

        return newOrder;
      });

      setDraggedIndex(null);
    },
    [draggedIndex, cardActions, onDataChange, requiresOrdering],
  );

  const getCardsForOrdering = useCallback(() => {
    // Only cards that will go back on deck should be ordered
    return cardOrder.filter(index => {
      const action = cardActions[index];
      // Cards marked topdeck or keep need ordering
      return action === "topdeck" || action === "keep";
    });
  }, [cardOrder, cardActions]);

  const handleReorder = useCallback(
    (newOrder: number[]) => {
      setCardOrder(newOrder);

      // Notify parent immediately
      const cardsToOrder = newOrder.filter(idx => {
        const action = cardActions[idx];
        return action === "topdeck" || action === "keep";
      });
      onDataChange({
        cardActions,
        cardOrder: requiresOrdering ? cardsToOrder : undefined,
      });
    },
    [cardActions, onDataChange, requiresOrdering],
  );

  const cardsToOrder = getCardsForOrdering();

  // Check if all topdecked cards are the same (no need to order)
  const needsOrdering =
    cardsToOrder.length > 1 &&
    new Set(cardsToOrder.map(index => cards[index])).size > 1;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        width: "min(700px, 90%)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          background: "rgba(26, 26, 46, 0.75)",
          backdropFilter: "blur(12px)",
          border: "2px solid rgb(205 133 63)",
          padding: "var(--space-3)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
          maxHeight: "50vh",
          overflow: "auto",
          position: "relative",
        }}
      >
        {/* Label */}
        <div
          style={{
            position: "absolute",
            top: "var(--space-1)",
            left: "var(--space-2)",
            fontSize: "0.625rem",
            color: "rgb(205 133 63)",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          Decision
        </div>

        {/* Cards */}
        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            justifyContent: "center",
            padding: "var(--space-2)",
          }}
        >
          {cardOrder.map(cardIndex => {
            const card = cards[cardIndex];
            const action = actions.find(a => a.id === cardActions[cardIndex]);
            const isDragging = draggedIndex === cardIndex;

            const getHighlightMode = ():
              | "trash"
              | "discard"
              | "gain"
              | undefined => {
              if (action?.id === "trash") return "trash";
              if (action?.id === "discard") return "discard";
              if (action?.id === "topdeck" || action?.id === "keep")
                return "gain";
            };

            return (
              <div
                key={cardIndex}
                style={{
                  opacity: isDragging ? 0.5 : 1,
                  position: "relative",
                }}
              >
                <div
                  draggable={requiresOrdering}
                  onDragStart={e => {
                    e.dataTransfer.effectAllowed = "move";
                    handleDragStart(cardIndex);
                  }}
                  onDragOver={handleDragOver}
                  onDrop={e => {
                    e.preventDefault();
                    handleDrop(cardIndex);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                  style={{
                    cursor: requiresOrdering ? "grab" : "pointer",
                    userSelect: "none",
                  }}
                >
                  <Card
                    name={card}
                    size="large"
                    onClick={() => toggleCardAction(cardIndex)}
                    highlightMode={getHighlightMode()}
                  />
                </div>
                {/* Action indicator */}
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
                {/* Reorder arrows - only show if this card is being topdecked and there are multiple DIFFERENT cards to order */}
                {requiresOrdering &&
                  (action?.id === "topdeck" || action?.id === "keep") &&
                  needsOrdering &&
                  cardsToOrder.includes(cardIndex) && (
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
                          const currentPos = cardsToOrder.indexOf(cardIndex);
                          if (currentPos > 0) {
                            const newOrder = [...cardOrder];
                            const idx1 = newOrder.indexOf(
                              cardsToOrder[currentPos],
                            );
                            const idx2 = newOrder.indexOf(
                              cardsToOrder[currentPos - 1],
                            );
                            [newOrder[idx1], newOrder[idx2]] = [
                              newOrder[idx2],
                              newOrder[idx1],
                            ];
                            handleReorder(newOrder);
                          }
                        }}
                        style={{
                          background: "rgba(0, 0, 0, 0.7)",
                          border: "1px solid white",
                          borderRadius: "3px",
                          color: "white",
                          cursor: "pointer",
                          padding: "2px 6px",
                          fontSize: "0.75rem",
                          lineHeight: 1,
                        }}
                      >
                        ◀
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const currentPos = cardsToOrder.indexOf(cardIndex);
                          if (currentPos < cardsToOrder.length - 1) {
                            const newOrder = [...cardOrder];
                            const idx1 = newOrder.indexOf(
                              cardsToOrder[currentPos],
                            );
                            const idx2 = newOrder.indexOf(
                              cardsToOrder[currentPos + 1],
                            );
                            [newOrder[idx1], newOrder[idx2]] = [
                              newOrder[idx2],
                              newOrder[idx1],
                            ];
                            handleReorder(newOrder);
                          }
                        }}
                        style={{
                          background: "rgba(0, 0, 0, 0.7)",
                          border: "1px solid white",
                          borderRadius: "3px",
                          color: "white",
                          cursor: "pointer",
                          padding: "2px 6px",
                          fontSize: "0.75rem",
                          lineHeight: 1,
                        }}
                      >
                        ▶
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
