import type { Player, CardName } from "../types/game-state";
import { CARDS } from "../data/cards";

// Simple hash function to assign consistent colors to player names
function getPlayerColor(player: Player): string {
  return player === "human" ? "var(--color-human)" : "var(--color-ai)";
}

export function getCardColor(card: CardName): string {
  const cardDef = CARDS[card];
  // Priority order: curse > attack > reaction > treasure > victory > action
  if (cardDef.types.includes("curse")) return "var(--color-curse)";
  if (cardDef.types.includes("attack")) return "var(--color-attack)";
  if (cardDef.types.includes("reaction")) return "var(--color-reaction)";
  if (cardDef.types.includes("treasure")) return "var(--color-gold-bright)";
  if (cardDef.types.includes("victory")) return "var(--color-victory)";
  if (cardDef.types.includes("action")) return "var(--color-action)";
  return "var(--color-text-primary)";
}

export function PlayerName({ player }: { player: Player }) {
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
  const sign = showSign ? (coins >= 0 ? "+" : "") : "";
  return (
    <span style={{ color: "var(--color-gold-bright)", fontWeight: 700 }}>
      {sign}${coins}
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

export function Verb({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "var(--color-text-primary)", fontStyle: "italic" }}>
      {children}
    </span>
  );
}
