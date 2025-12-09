import type { CardName, GameState } from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { CARDS } from "../data/cards";
import { Card } from "./Card";
import { Pile } from "./Pile";
import { useState } from "preact/hooks";

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
          style={{
            fontSize: "0.625rem",
            color: "#ef4444",
            marginBlockEnd: "var(--space-2)",
            textTransform: "uppercase",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
          }}
        >
          Trash
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-1)",
          }}
        >
          <Pile cards={state.trash} pileType="trash" />
        </div>
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
