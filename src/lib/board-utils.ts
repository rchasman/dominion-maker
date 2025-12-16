import type { CardName, LogEntry, GameState } from "../types/game-state";
import { CARDS } from "../data/cards";
import { run } from "./run";

const HASH_MULTIPLIER = 5;
const GARDENS_VP_DIVISOR = 10;

/**
 * Player colors for consistent visual identification
 * Ordered by distinctiveness for 2-player games
 */
const PLAYER_COLORS = [
  "#3b82f6", // Blue - Player 1
  "#ef4444", // Red - Player 2
  "#10b981", // Green - Player 3
  "#f59e0b", // Amber - Player 4
  "#8b5cf6", // Purple - Player 5
  "#ec4899", // Pink - Player 6
  "#14b8a6", // Teal - Player 7
  "#f97316", // Orange - Player 8
] as const;

/**
 * Deterministic color mapping for specific player IDs
 * Ensures consistent colors across mode switches
 */
const FIXED_PLAYER_COLORS: Record<string, number> = {
  human: 0, // Blue
  player: 0, // Blue (converted human)
  ai: 1, // Red
};

/**
 * Get unique color for each player using deterministic hash
 * Same player ID always gets same color, but different players get different colors
 */
export function getPlayerColor(playerId: string): string {
  // Check if this is a fixed player ID
  if (playerId in FIXED_PLAYER_COLORS) {
    const index = FIXED_PLAYER_COLORS[playerId];
    return PLAYER_COLORS[index];
  }

  // For dynamic player names, use hash-based color selection
  const hash = playerId.split("").reduce((acc, char) => {
    const shifted = (acc << HASH_MULTIPLIER) - acc + char.charCodeAt(0);
    return shifted & shifted; // Convert to 32-bit integer
  }, 0);

  const index = Math.abs(hash) % PLAYER_COLORS.length;
  return PLAYER_COLORS[index];
}

/**
 * Format player name for display with optional AI suffix
 */
export function formatPlayerName(
  playerId: string,
  isAI: boolean,
  options?: { capitalize?: boolean; gameState?: GameState },
): string {
  const { capitalize = true, gameState } = options || {};

  // Use actual name from playerInfo if available
  const playerInfo = gameState?.playerInfo?.[playerId];
  if (playerInfo) {
    return isAI ? `${playerInfo.name} (AI)` : playerInfo.name;
  }

  // Fallback for local-only single-player
  const baseName = run(() => {
    if (playerId === "human") return "You";
    if (playerId === "player") return capitalize ? "Player" : "player";
    if (playerId === "ai") return "ai";
    return playerId; // Show clientId as last resort
  });

  // Add AI suffix if needed (but not if already named "ai")
  const name =
    isAI && playerId !== "human" && playerId !== "ai"
      ? `${baseName} (AI)`
      : baseName;

  return name;
}

export function countVP(cards: CardName[]): number {
  return cards.reduce((vp, card) => {
    const { vp: cardVP } = CARDS[card];
    if (cardVP === "variable") {
      return vp + Math.floor(cards.length / GARDENS_VP_DIVISOR);
    }
    return vp + (typeof cardVP === "number" ? cardVP : 0);
  }, 0);
}

export function getAllCards({
  deck,
  hand,
  discard,
  inPlay,
}: {
  deck: CardName[];
  hand: CardName[];
  discard: CardName[];
  inPlay: CardName[];
}): CardName[] {
  return [...deck, ...hand, ...discard, ...inPlay];
}

// Aggregate consecutive identical log entries for display
// Returns aggregated entries with eventIds preserved (array of eventIds for grouped entries)

const isAggregatable = (entry: LogEntry) =>
  [
    "play-treasure",
    "unplay-treasure",
    "buy-card",
    "gain-card",
    "discard-cards",
    "draw-cards",
  ].includes(entry.type);

const canMatchNext = (current: LogEntry, next: LogEntry): boolean => {
  if (next.type !== current.type) return false;
  if (!("player" in next) || !("player" in current)) return false;
  if (next.player !== current.player) return false;

  if ("card" in next && "card" in current) {
    return next.card === current.card;
  }
  return current.type === "discard-cards" || current.type === "draw-cards";
};

const collectConsecutive = (
  log: LogEntry[],
  startIndex: number,
): { entries: LogEntry[]; count: number } => {
  const current = log[startIndex];
  const consecutiveCount = log
    .slice(startIndex + 1)
    .findIndex(next => !canMatchNext(current, next));

  const count =
    consecutiveCount === -1 ? log.length - startIndex : consecutiveCount + 1;

  return { entries: log.slice(startIndex, startIndex + count), count };
};

const aggregateGroup = (
  entries: LogEntry[],
): LogEntry & { eventIds?: string[] } => {
  const [first] = entries;
  const count = entries.length;

  const eventIds = entries
    .map(e => e.eventId)
    .filter((id): id is string => id !== undefined);
  const allCards = entries.flatMap(e =>
    (e.type === "discard-cards" || e.type === "draw-cards") && e.cards
      ? e.cards
      : [],
  );
  const allChildren: LogEntry[] = entries.flatMap(e => e.children ?? []);
  const aggregatedChildren =
    allChildren.length > 0 ? aggregateLogEntries(allChildren) : [];

  if (first.type === "play-treasure" || first.type === "unplay-treasure") {
    const totalCoins = entries.reduce(
      (sum, e) =>
        sum +
        (e.type === "play-treasure" || e.type === "unplay-treasure"
          ? e.coins
          : 0),
      0,
    );
    return {
      ...first,
      coins: totalCoins,
      children:
        count > 1
          ? [{ type: "text", message: `${count}x` }, ...aggregatedChildren]
          : aggregatedChildren,
      eventIds,
    };
  }

  if (first.type === "buy-card") {
    const totalVP = entries.reduce(
      (sum, e) =>
        sum + (e.type === "buy-card" && e.vp !== undefined ? e.vp : 0),
      0,
    );
    return {
      ...first,
      vp: totalVP !== 0 ? totalVP : undefined,
      children: [{ type: "text", message: `${count}x` }, ...aggregatedChildren],
      eventIds,
    };
  }

  if (first.type === "discard-cards" || first.type === "draw-cards") {
    const totalCount = entries.reduce(
      (sum, e) =>
        sum +
        (e.type === "discard-cards" || e.type === "draw-cards" ? e.count : 0),
      0,
    );
    return {
      ...first,
      count: totalCount,
      cards: allCards.length > 0 ? allCards : undefined,
      eventIds,
    };
  }

  // gain-card
  return {
    ...first,
    children: [{ type: "text", message: `${count}x` }, ...aggregatedChildren],
    eventIds,
  };
};

export function aggregateLogEntries(
  log: LogEntry[],
): (LogEntry & { eventIds?: string[] })[] {
  if (log.length === 0) return [];

  const processEntries = (
    index: number,
    acc: (LogEntry & { eventIds?: string[] })[],
  ): (LogEntry & { eventIds?: string[] })[] => {
    if (index >= log.length) return acc;

    const current = log[index];

    if (isAggregatable(current)) {
      const { entries, count } = collectConsecutive(log, index);
      return processEntries(index + count, [
        ...acc,
        count > 1 ? aggregateGroup(entries) : current,
      ]);
    }

    return processEntries(index + 1, [...acc, current]);
  };

  return processEntries(0, []);
}
