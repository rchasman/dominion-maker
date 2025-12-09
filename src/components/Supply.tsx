import type { CardName, GameState } from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { CARDS } from "../data/cards";
import { Card } from "./Card";
import { useState } from "preact/hooks";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  useClientPoint,
} from "@floating-ui/react";

interface SupplyProps {
  state: GameState;
  onBuyCard?: (card: CardName) => void;
  canBuy: boolean;
  availableCoins: number;
  pendingDecision?: DecisionRequest | null;
}

export function Supply({
  state,
  onBuyCard,
  canBuy,
  availableCoins,
  pendingDecision,
}: SupplyProps) {
  const treasures: CardName[] = ["Copper", "Silver", "Gold"];
  const victory: CardName[] = ["Estate", "Duchy", "Province"];

  const canInteract = (card: CardName) => {
    // If there's a gain decision from supply, only enable cards in the options
    if (pendingDecision && pendingDecision.from === "supply") {
      const options = pendingDecision.cardOptions || [];
      return options.includes(card) && state.supply[card] > 0;
    }

    // Normal buy phase logic
    return (
      canBuy && CARDS[card].cost <= availableCoins && state.supply[card] > 0
    );
  };

  // Determine highlight mode for supply cards
  const getSupplyCardHighlightMode = (
    card: CardName,
  ): "trash" | "discard" | "gain" | undefined => {
    if (!pendingDecision || pendingDecision.from !== "supply") return undefined;

    // Check if this card is in the gain options
    const options = pendingDecision.cardOptions || [];
    const isGainable = options.includes(card);
    return isGainable ? "gain" : undefined;
  };

  // Sort kingdom cards by cost, bottom row first (cheapest at bottom-left)
  const sorted = [...state.kingdomCards].sort(
    (a, b) => CARDS[a].cost - CARDS[b].cost,
  );
  const sortedKingdom = [...sorted.slice(5), ...sorted.slice(0, 5)];

  // Trash pile tooltip state
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isTrashOpen,
    onOpenChange: setIsTrashOpen,
    placement: "left",
    middleware: [
      offset({ mainAxis: 8, crossAxis: 0 }),
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const { setReference, setFloating } = refs;

  const hover = useHover(context);
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const clientPoint = useClientPoint(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
    clientPoint,
  ]);

  // Count occurrences of each card in trash
  const trashCounts = state.trash.reduce(
    (acc, card) => {
      acc[card] = (acc[card] || 0) + 1;
      return acc;
    },
    {} as Record<CardName, number>,
  );

  const uniqueTrashCards = Object.keys(trashCounts) as CardName[];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto",
        gridTemplateAreas: '"victory treasure kingdom curse trash"',
        gap: "var(--space-4)",
        padding: "var(--space-3) var(--space-4)",
        background: "rgba(70, 70, 95, 0.25)",
        backdropFilter: "blur(12px)",
        borderRadius: "0.5rem",
        alignItems: "start",
        alignContent: "start",
      }}
    >
      {/* Victory column */}
      <div
        style={{ gridArea: "victory", paddingInlineStart: "var(--space-4)" }}
      >
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-victory)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Victory
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexWrap: "wrap",
            gap: "var(--space-1)",
            maxBlockSize: "30rem",
            alignContent: "start",
          }}
        >
          {victory.map(card => (
            <Card
              key={card}
              name={card}
              size="small"
              count={state.supply[card]}
              onClick={() => onBuyCard?.(card)}
              disabled={!canInteract(card)}
              highlightMode={getSupplyCardHighlightMode(card)}
            />
          ))}
        </div>
      </div>

      {/* Treasure column */}
      <div style={{ gridArea: "treasure" }}>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-gold)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Treasure
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexWrap: "wrap",
            gap: "var(--space-1)",
            maxBlockSize: "30rem",
            alignContent: "start",
          }}
        >
          {treasures.map(card => (
            <Card
              key={card}
              name={card}
              size="small"
              count={state.supply[card]}
              onClick={() => onBuyCard?.(card)}
              disabled={!canInteract(card)}
              highlightMode={getSupplyCardHighlightMode(card)}
            />
          ))}
        </div>
      </div>

      {/* Kingdom cards */}
      <div style={{ gridArea: "kingdom", minInlineSize: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(5, minmax(0, var(--card-width-large)))",
            justifyContent: "center",
            marginBlockEnd: "var(--space-2)",
          }}
        >
          <div
            style={{
              fontSize: "0.625rem",
              color: "var(--color-text-primary)",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Kingdom
          </div>
        </div>
        <div className="kingdom-grid">
          {sortedKingdom.map(card => (
            <Card
              key={card}
              name={card}
              size="large"
              count={state.supply[card]}
              onClick={() => onBuyCard?.(card)}
              disabled={!canInteract(card)}
              highlightMode={getSupplyCardHighlightMode(card)}
            />
          ))}
        </div>
      </div>

      {/* Trash pile */}
      <div style={{ gridArea: "trash", paddingInlineEnd: "var(--space-4)" }}>
        <div
          ref={setReference}
          {...getReferenceProps()}
          style={{
            fontSize: "0.625rem",
            color: "#ef4444",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            cursor: state.trash.length > 0 ? "help" : "default",
          }}
        >
          Trash
          {state.trash.length > 0 && (
            <span
              style={{
                fontSize: "0.875rem",
                opacity: 0.7,
                color: "var(--color-info)",
                fontWeight: "normal",
              }}
            >
              ⓘ
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          {state.trash.length > 0 ? (
            <Card
              name={state.trash[state.trash.length - 1]}
              size="small"
              count={state.trash.length}
              disabled={true}
            />
          ) : (
            <div
              style={{
                width: "var(--card-width-small)",
                aspectRatio: "5 / 7.8",
                border: "1px dashed var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--color-text-muted)",
                fontSize: "0.5625rem",
                background: "var(--color-bg-primary)",
              }}
            >
              Empty
            </div>
          )}
        </div>

        {/* Trash tooltip */}
        {isTrashOpen && state.trash.length > 0 && (
          <div
            ref={setFloating}
            style={{
              ...floatingStyles,
              background: "rgba(26, 26, 46, 0.75)",
              backdropFilter: "blur(12px)",
              border: "2px solid #ef4444",
              padding: "1rem",
              maxWidth: "320px",
              zIndex: 10000,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
              pointerEvents: "none",
            }}
            {...getFloatingProps()}
          >
            <div
              style={{
                position: "absolute",
                top: "var(--space-2)",
                left: "var(--space-2)",
                fontSize: "0.625rem",
                color: "#ef4444",
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              Trash ({state.trash.length} cards)
            </div>
            <div
              style={{
                fontSize: "0.8125rem",
                lineHeight: "1.5",
                color: "var(--color-text-primary)",
                paddingTop: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-2)",
                }}
              >
                {uniqueTrashCards.map(card => (
                  <div
                    key={card}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-1)",
                    }}
                  >
                    <Card name={card} size="small" disabled={true} />
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      ×{trashCounts[card]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Curse pile */}
      <div style={{ gridArea: "curse" }}>
        <div
          style={{
            fontSize: "0.625rem",
            color: "var(--color-curse)",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            minHeight: "0.875rem",
          }}
        >
          Curse
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          <Card
            name="Curse"
            size="small"
            count={state.supply["Curse"]}
            onClick={() => onBuyCard?.("Curse")}
            disabled={!canInteract("Curse")}
            highlightMode={getSupplyCardHighlightMode("Curse")}
          />
        </div>
      </div>
    </div>
  );
}
