import type { CardName } from "../types/game-state";
import { CARDS } from "../data/cards";
import { getPlayerColor } from "../lib/board-utils";

export function getCardColor(card: CardName): string {
  const cardDef = CARDS[card];
  if (!cardDef) {
    console.error(`Card definition not found for: ${card}`);
    return "var(--color-text-primary)";
  }
  // Priority order: curse > attack > reaction > treasure > victory > action
  if (cardDef.types.includes("curse")) return "var(--color-curse)";
  if (cardDef.types.includes("attack")) return "var(--color-attack)";
  if (cardDef.types.includes("reaction")) return "var(--color-reaction)";
  if (cardDef.types.includes("treasure")) return "var(--color-gold-bright)";
  if (cardDef.types.includes("victory")) return "var(--color-victory)";
  if (cardDef.types.includes("action")) return "var(--color-action)";
  return "var(--color-text-primary)";
}

export function PlayerName({ player }: { player: string }) {
  return (
    <span style={{ color: getPlayerColor(player), fontWeight: 600 }}>
      {player}
    </span>
  );
}

export function CardNameSpan({ card }: { card: CardName }) {
  return (
    <span style={{ color: getCardColor(card), fontWeight: 600 }}>
      {card}
    </span>
  );
}

export function CoinValue({ coins, showSign = true }: { coins: number; showSign?: boolean }) {
  const sign = coins >= 0 ? "+" : "-";
  const absCoins = Math.abs(coins);
  return (
    <span style={{ color: "var(--color-gold-bright)", fontWeight: 700 }}>
      {showSign && sign}{absCoins} {absCoins === 1 ? "Coin" : "Coins"}
    </span>
  );
}

export function VPValue({ vp }: { vp: number }) {
  return (
    <span style={{ color: "var(--color-victory)", fontWeight: 700 }}>
      {vp} VP
    </span>
  );
}

export function ActionValue({ count }: { count: number }) {
  const sign = count >= 0 ? "+" : "-";
  const absCount = Math.abs(count);
  return (
    <span style={{ color: "var(--color-action-phase)", fontWeight: 700 }}>
      {sign}{absCount} {absCount === 1 ? "Action" : "Actions"}
    </span>
  );
}

export function BuyValue({ count }: { count: number }) {
  const sign = count >= 0 ? "+" : "-";
  const absCount = Math.abs(count);
  return (
    <span style={{ color: "var(--color-buy-phase)", fontWeight: 700 }}>
      {sign}{absCount} {absCount === 1 ? "Buy" : "Buys"}
    </span>
  );
}

export function Verb({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "var(--color-text-primary)", fontStyle: "italic" }}>
      {children}
    </span>
  );
}
