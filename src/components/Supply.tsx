import type { CardName, GameState, PendingDecision } from "../types/game-state";
import { CARDS } from "../data/cards";
import { Card } from "./Card";

interface SupplyProps {
  state: GameState;
  onBuyCard?: (card: CardName) => void;
  canBuy: boolean;
  availableCoins: number;
  pendingDecision?: PendingDecision | null;
}

export function Supply({ state, onBuyCard, canBuy, availableCoins, pendingDecision }: SupplyProps) {
  const treasures: CardName[] = ["Copper", "Silver", "Gold"];
  const victory: CardName[] = ["Estate", "Duchy", "Province", "Curse"];

  const canInteract = (card: CardName) => {
    // If there's a gain decision, only enable cards in the options
    if (pendingDecision && pendingDecision.type === "gain") {
      return pendingDecision.options.includes(card) && state.supply[card] > 0;
    }

    // Normal buy phase logic
    return canBuy && CARDS[card].cost <= availableCoins && state.supply[card] > 0;
  };

  // Determine highlight mode for supply cards
  const getSupplyCardHighlightMode = (card: CardName): "trash" | "discard" | "gain" | undefined => {
    if (!pendingDecision || pendingDecision.type !== "gain") return undefined;

    // Check if this card is in the gain options
    const isGainable = pendingDecision.options.includes(card);
    return isGainable ? "gain" : undefined;
  };

  // Sort kingdom cards by cost, bottom row first (cheapest at bottom-left)
  const sorted = [...state.kingdomCards].sort((a, b) => CARDS[a].cost - CARDS[b].cost);
  const sortedKingdom = [...sorted.slice(5), ...sorted.slice(0, 5)];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto auto 1fr",
      gridTemplateAreas: '"victory treasure kingdom"',
      gap: "var(--space-6)",
      padding: "var(--space-6) var(--space-5)",
      background: "linear-gradient(180deg, var(--color-bg-supply) 0%, var(--color-bg-supply-alt) 100%)",
      border: "1px solid var(--color-border-supply)",
      alignItems: "start",
      alignContent: "start",
    }}>
      {/* Victory column */}
      <div style={{ gridArea: "victory", paddingInlineStart: "var(--space-4)" }}>
        <div style={{
          fontSize: "0.625rem",
          color: "var(--color-victory)",
          marginBlockEnd: "var(--space-2)",
          textTransform: "uppercase",
          fontWeight: 600
        }}>
          Victory
        </div>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          {victory.map((card) => (
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
        <div style={{
          fontSize: "0.625rem",
          color: "var(--color-gold)",
          marginBlockEnd: "var(--space-2)",
          textTransform: "uppercase",
          fontWeight: 600
        }}>
          Treasure
        </div>
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          {treasures.map((card) => (
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
      <div style={{ gridArea: "kingdom", minInlineSize: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div>
          <div style={{
            fontSize: "0.625rem",
            color: "var(--color-text-primary)",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBlockEnd: "var(--space-2)",
          }}>
            Kingdom
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, auto)",
            gap: "0.125rem",
            justifyContent: "center",
          }}>
            {sortedKingdom.map((card) => (
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
      </div>
    </div>
  );
}
