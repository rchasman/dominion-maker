import type { CardName, GameState } from "../types/game-state";
import { CARDS } from "../data/cards";
import { Card } from "./Card";

interface SupplyProps {
  state: GameState;
  onBuyCard?: (card: CardName) => void;
  canBuy: boolean;
  availableCoins: number;
}

export function Supply({ state, onBuyCard, canBuy, availableCoins }: SupplyProps) {
  const baseCards: CardName[] = [
    "Copper",
    "Silver",
    "Gold",
    "Estate",
    "Duchy",
    "Province",
    "Curse",
  ];

  const canAfford = (card: CardName) =>
    canBuy && CARDS[card].cost <= availableCoins && state.supply[card] > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <h3 style={{ margin: 0 }}>Supply</h3>

      {/* Base cards */}
      <div>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
          Base Cards
        </h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {baseCards.map((card) => (
            <Card
              key={card}
              name={card}
              count={state.supply[card]}
              onClick={() => onBuyCard?.(card)}
              disabled={!canAfford(card)}
            />
          ))}
        </div>
      </div>

      {/* Kingdom cards */}
      <div>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
          Kingdom Cards
        </h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {state.kingdomCards.map((card) => (
            <Card
              key={card}
              name={card}
              count={state.supply[card]}
              onClick={() => onBuyCard?.(card)}
              disabled={!canAfford(card)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
