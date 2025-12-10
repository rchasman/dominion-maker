import type { CardName, GameState } from "../types/game-state";
import type { DecisionRequest } from "../events/types";
import { CARDS } from "../data/cards";
import { Card } from "./Card";
import { Pile } from "./Pile";

const KINGDOM_GRID_COLUMNS = 5;

interface SupplyProps {
  state: GameState;
  onBuyCard?: (card: CardName) => void;
  canBuy: boolean;
  availableCoins: number;
  pendingDecision?: DecisionRequest | null;
}

function canInteractWithCard(
  card: CardName,
  canBuyCard: { canBuy: boolean; availableCoins: number },
  state: GameState,
  pendingDecision: DecisionRequest | undefined | null,
): boolean {
  // If there's a gain decision from supply, only enable cards in the options
  if (pendingDecision && pendingDecision.from === "supply") {
    const options = pendingDecision.cardOptions || [];
    return options.includes(card) && state.supply[card] > 0;
  }

  // Normal buy phase logic
  return (
    canBuyCard.canBuy &&
    CARDS[card].cost <= canBuyCard.availableCoins &&
    state.supply[card] > 0
  );
}

function getSupplyCardHighlightMode(
  card: CardName,
  pendingDecision: DecisionRequest | undefined | null,
): "trash" | "discard" | "gain" | undefined {
  if (!pendingDecision || pendingDecision.from !== "supply") return undefined;

  // Check if this card is in the gain options
  const options = pendingDecision.cardOptions || [];
  const isGainable = options.includes(card);
  return isGainable ? "gain" : undefined;
}

function renderSupplyColumn(params: {
  cards: CardName[];
  size: "small" | "large";
  state: GameState;
  canBuyParams: { canBuy: boolean; availableCoins: number };
  pendingDecision: DecisionRequest | undefined | null;
  onBuyCard: ((card: CardName) => void) | undefined;
}) {
  const { cards, size, state, canBuyParams, pendingDecision, onBuyCard } =
    params;

  return (
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
      {cards.map(card => (
        <Card
          key={card}
          name={card}
          size={size}
          count={state.supply[card]}
          onClick={() => onBuyCard?.(card)}
          disabled={
            !canInteractWithCard(card, canBuyParams, state, pendingDecision)
          }
          highlightMode={getSupplyCardHighlightMode(card, pendingDecision)}
        />
      ))}
    </div>
  );
}

function renderSupplyGrid(params: {
  state: GameState;
  onBuyCard: ((card: CardName) => void) | undefined;
  canBuyParams: { canBuy: boolean; availableCoins: number };
  pendingDecision: DecisionRequest | undefined | null;
  treasures: CardName[];
  victory: CardName[];
  sortedKingdom: CardName[];
}) {
  const {
    state,
    onBuyCard,
    canBuyParams,
    pendingDecision,
    treasures,
    victory,
    sortedKingdom,
  } = params;

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
        {renderSupplyColumn({
          cards: victory,
          size: "small",
          state,
          canBuyParams,
          pendingDecision,
          onBuyCard,
        })}
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
        {renderSupplyColumn({
          cards: treasures,
          size: "small",
          state,
          canBuyParams,
          pendingDecision,
          onBuyCard,
        })}
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
              disabled={
                !canInteractWithCard(card, canBuyParams, state, pendingDecision)
              }
              highlightMode={getSupplyCardHighlightMode(card, pendingDecision)}
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
            disabled={
              !canInteractWithCard(
                "Curse",
                canBuyParams,
                state,
                pendingDecision,
              )
            }
            highlightMode={getSupplyCardHighlightMode("Curse", pendingDecision)}
          />
        </div>
      </div>
    </div>
  );
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

  // Sort kingdom cards by cost, bottom row first (cheapest at bottom-left)
  const sorted = [...state.kingdomCards].sort(
    (a, b) => CARDS[a].cost - CARDS[b].cost,
  );
  const sortedKingdom = [
    ...sorted.slice(KINGDOM_GRID_COLUMNS),
    ...sorted.slice(0, KINGDOM_GRID_COLUMNS),
  ];
  const canBuyParams = { canBuy, availableCoins };

  return renderSupplyGrid({
    state,
    onBuyCard,
    canBuyParams,
    pendingDecision,
    treasures,
    victory,
    sortedKingdom,
  });
}
