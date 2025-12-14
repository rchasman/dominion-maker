import { useState, useCallback } from "preact/compat";
import type { CardName, CardAction } from "../types/game-state";
import { Card } from "./Card";
import {
  ActionIndicator,
  ReorderButtons,
} from "./CardDecisionModal/CardRowComponents";

const OPACITY_DRAGGING = 0.5;

function getHighlightMode(
  actionId: string | undefined,
): "trash" | "discard" | "gain" | undefined {
  if (actionId === "trash") return "trash";
  if (actionId === "discard") return "discard";
  if (actionId === "topdeck" || actionId === "keep") return "gain";
  return undefined;
}

interface CardDecisionModalProps {
  cards: CardName[];
  actions: CardAction[];
  requiresOrdering?: boolean;
  onDataChange: (data: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void;
}

interface CardRowProps {
  cardIndex: number;
  card: CardName;
  action: CardAction | undefined;
  isDragging: boolean;
  requiresOrdering: boolean;
  needsOrdering: boolean;
  cardsToOrder: number[];
  cardOrder: number[];
  onToggleCardAction: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetIndex: number) => void;
  onSetDraggedIndex: (index: number | null) => void;
  onReorder: (newOrder: number[]) => void;
}

interface UseCardDecisionState {
  cardOrder: number[];
  cardActions: Record<number, string>;
  draggedIndex: number | null;
  needsOrdering: boolean;
  cardsToOrder: number[];
  toggleCardAction: (index: number) => void;
  handleDragStart: (index: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (targetIndex: number) => void;
  setDraggedIndex: (index: number | null) => void;
  handleReorder: (newOrder: number[]) => void;
}

function getInitialCardActions(
  cards: CardName[],
  actions: CardAction[],
): Record<number, string> {
  const defaultAction = actions.find(a => a.isDefault);
  return cards.reduce(
    (acc, _, index) => ({
      ...acc,
      [index]: defaultAction?.id || actions[0].id,
    }),
    {} as Record<number, string>,
  );
}

function getCardsToOrder(
  cardOrder: number[],
  cardActions: Record<number, string>,
): number[] {
  return cardOrder.filter(index => {
    const action = cardActions[index];
    return action === "topdeck" || action === "keep";
  });
}

function useCardDecisionState(
  cards: CardName[],
  actions: CardAction[],
  requiresOrdering: boolean,
  onDataChange: (data: {
    cardActions: Record<number, string>;
    cardOrder?: number[];
  }) => void,
): UseCardDecisionState {
  const [cardActions, setCardActions] = useState(() =>
    getInitialCardActions(cards, actions),
  );
  const [cardOrder, setCardOrder] = useState(cards.map((_, i) => i));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const toggleCardAction = useCallback(
    (index: number) => {
      setCardActions(prev => {
        const nextIdx =
          (actions.findIndex(a => a.id === prev[index]) + 1) % actions.length;
        const newActions = { ...prev, [index]: actions[nextIdx].id };
        onDataChange({
          cardActions: newActions,
          cardOrder: requiresOrdering
            ? getCardsToOrder(cardOrder, newActions)
            : undefined,
        });
        return newActions;
      });
    },
    [actions, cardOrder, onDataChange, requiresOrdering],
  );

  const handleDragStart = useCallback((i: number) => setDraggedIndex(i), []);
  const handleDragOver = useCallback(
    (e: React.DragEvent) => e.preventDefault(),
    [],
  );

  const handleDrop = useCallback(
    (target: number) => {
      if (draggedIndex === null || draggedIndex === target) return;
      setCardOrder(prev => {
        const order = [...prev];
        const dIdx = order.indexOf(draggedIndex);
        const tIdx = order.indexOf(target);
        order.splice(dIdx, 1);
        order.splice(tIdx, 0, draggedIndex);
        onDataChange({
          cardActions,
          cardOrder: requiresOrdering
            ? getCardsToOrder(order, cardActions)
            : undefined,
        });
        return order;
      });
      setDraggedIndex(null);
    },
    [draggedIndex, cardActions, onDataChange, requiresOrdering],
  );

  const handleReorder = useCallback(
    (order: number[]) => {
      setCardOrder(order);
      onDataChange({
        cardActions,
        cardOrder: requiresOrdering
          ? getCardsToOrder(order, cardActions)
          : undefined,
      });
    },
    [cardActions, onDataChange, requiresOrdering],
  );

  const cardsToOrder = getCardsToOrder(cardOrder, cardActions);
  const needsOrdering =
    cardsToOrder.length > 1 &&
    new Set(cardsToOrder.map(i => cards[i])).size > 1;
  return {
    cardOrder,
    cardActions,
    draggedIndex,
    needsOrdering,
    cardsToOrder,
    toggleCardAction,
    handleDragStart,
    handleDragOver,
    handleDrop,
    setDraggedIndex,
    handleReorder,
  };
}

export function CardDecisionModal({
  cards,
  actions,
  requiresOrdering = false,
  onDataChange,
}: CardDecisionModalProps) {
  const {
    cardOrder,
    cardActions,
    draggedIndex,
    needsOrdering,
    cardsToOrder,
    toggleCardAction,
    handleDragStart,
    handleDragOver,
    handleDrop,
    setDraggedIndex,
    handleReorder,
  } = useCardDecisionState(cards, actions, requiresOrdering, onDataChange);

  return (
    <CardDecisionModalUI
      cardOrder={cardOrder}
      cards={cards}
      actions={actions}
      cardActions={cardActions}
      draggedIndex={draggedIndex}
      requiresOrdering={requiresOrdering}
      needsOrdering={needsOrdering}
      cardsToOrder={cardsToOrder}
      onToggleCardAction={toggleCardAction}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onSetDraggedIndex={setDraggedIndex}
      onReorder={handleReorder}
    />
  );
}

interface CardDecisionModalUIProps {
  cardOrder: number[];
  cards: CardName[];
  actions: CardAction[];
  cardActions: Record<number, string>;
  draggedIndex: number | null;
  requiresOrdering: boolean;
  needsOrdering: boolean;
  cardsToOrder: number[];
  onToggleCardAction: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetIndex: number) => void;
  onSetDraggedIndex: (index: number | null) => void;
  onReorder: (newOrder: number[]) => void;
}

function CardDecisionModalUI({
  cardOrder,
  cards,
  actions,
  cardActions,
  draggedIndex,
  requiresOrdering,
  needsOrdering,
  cardsToOrder,
  onToggleCardAction,
  onDragStart,
  onDragOver,
  onDrop,
  onSetDraggedIndex,
  onReorder,
}: CardDecisionModalUIProps) {
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
      <ModalContent
        cardOrder={cardOrder}
        cards={cards}
        actions={actions}
        cardActions={cardActions}
        draggedIndex={draggedIndex}
        requiresOrdering={requiresOrdering}
        needsOrdering={needsOrdering}
        cardsToOrder={cardsToOrder}
        onToggleCardAction={onToggleCardAction}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onSetDraggedIndex={onSetDraggedIndex}
        onReorder={onReorder}
      />
    </div>
  );
}

function ModalContent({
  cardOrder,
  cards,
  actions,
  cardActions,
  draggedIndex,
  requiresOrdering,
  needsOrdering,
  cardsToOrder,
  onToggleCardAction,
  onDragStart,
  onDragOver,
  onDrop,
  onSetDraggedIndex,
  onReorder,
}: CardDecisionModalUIProps) {
  return (
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
      <ModalLabel />
      <CardGrid
        cardOrder={cardOrder}
        cards={cards}
        actions={actions}
        cardActions={cardActions}
        draggedIndex={draggedIndex}
        requiresOrdering={requiresOrdering}
        needsOrdering={needsOrdering}
        cardsToOrder={cardsToOrder}
        onToggleCardAction={onToggleCardAction}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onSetDraggedIndex={onSetDraggedIndex}
        onReorder={onReorder}
      />
    </div>
  );
}

function ModalLabel() {
  return (
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
  );
}

function CardGrid({
  cardOrder,
  cards,
  actions,
  cardActions,
  draggedIndex,
  requiresOrdering,
  needsOrdering,
  cardsToOrder,
  onToggleCardAction,
  onDragStart,
  onDragOver,
  onDrop,
  onSetDraggedIndex,
  onReorder,
}: CardDecisionModalUIProps) {
  return (
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

        return (
          <CardRow
            key={cardIndex}
            cardIndex={cardIndex}
            card={card}
            action={action}
            isDragging={isDragging}
            requiresOrdering={requiresOrdering}
            needsOrdering={needsOrdering}
            cardsToOrder={cardsToOrder}
            cardOrder={cardOrder}
            onToggleCardAction={onToggleCardAction}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onSetDraggedIndex={onSetDraggedIndex}
            onReorder={onReorder}
          />
        );
      })}
    </div>
  );
}

function CardRow({
  cardIndex,
  card,
  action,
  isDragging,
  requiresOrdering,
  needsOrdering,
  cardsToOrder,
  cardOrder,
  onToggleCardAction,
  onDragStart,
  onDragOver,
  onDrop,
  onSetDraggedIndex,
  onReorder,
}: CardRowProps) {
  const shouldShowReorderButtons =
    requiresOrdering &&
    (action?.id === "topdeck" || action?.id === "keep") &&
    needsOrdering &&
    cardsToOrder.includes(cardIndex);

  return (
    <div
      style={{
        opacity: isDragging ? OPACITY_DRAGGING : 1,
        position: "relative",
      }}
    >
      <div
        draggable={requiresOrdering}
        onDragStart={e => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(cardIndex);
        }}
        onDragOver={onDragOver}
        onDrop={e => {
          e.preventDefault();
          onDrop(cardIndex);
        }}
        onDragEnd={() => onSetDraggedIndex(null)}
        style={{
          cursor: requiresOrdering ? "grab" : "pointer",
          userSelect: "none",
        }}
      >
        <Card
          name={card}
          size="large"
          onClick={() => onToggleCardAction(cardIndex)}
          highlightMode={getHighlightMode(action?.id)}
        />
      </div>
      <ActionIndicator
        action={action}
        needsOrdering={needsOrdering}
        cardsToOrder={cardsToOrder}
        cardIndex={cardIndex}
      />
      {shouldShowReorderButtons && (
        <ReorderButtons
          cardIndex={cardIndex}
          cardsToOrder={cardsToOrder}
          cardOrder={cardOrder}
          onReorder={onReorder}
        />
      )}
    </div>
  );
}
