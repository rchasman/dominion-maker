import type { CardName } from "../types/game-state";
import { getPlayerColor, formatPlayerName } from "../lib/board-utils";
import { getCardColor } from "../lib/card-colors";
import { useGame } from "../context/hooks";

export function PlayerName({
  player,
  isAI,
}: {
  player: string;
  isAI?: boolean;
}) {
  const { gameState, players } = useGame();

  // Try to get name from players list (multiplayer) or playerInfo (single-player/server)
  const playerName = players?.find(p => p.playerId === player)?.name;

  const displayName = playerName
    ? isAI
      ? `${playerName} (AI)`
      : playerName
    : formatPlayerName(player, isAI || false, { gameState });

  return (
    <span style={{ color: getPlayerColor(player), fontWeight: 600 }}>
      {displayName}
    </span>
  );
}

export function CardNameSpan({ card }: { card: CardName }) {
  return (
    <span style={{ color: getCardColor(card), fontWeight: 600 }}>{card}</span>
  );
}

export function CoinValue({
  coins,
  showSign = true,
}: {
  coins: number;
  showSign?: boolean;
}) {
  const sign = coins >= 0 ? "+" : "-";
  const absCoins = Math.abs(coins);
  return (
    <span style={{ color: "var(--color-gold-bright)", fontWeight: 700 }}>
      {showSign && sign}
      {absCoins} {absCoins === 1 ? "Coin" : "Coins"}
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
      {sign}
      {absCount} {absCount === 1 ? "Action" : "Actions"}
    </span>
  );
}

export function BuyValue({ count }: { count: number }) {
  const sign = count >= 0 ? "+" : "-";
  const absCount = Math.abs(count);
  return (
    <span style={{ color: "var(--color-buy-phase)", fontWeight: 700 }}>
      {sign}
      {absCount} {absCount === 1 ? "Buy" : "Buys"}
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
