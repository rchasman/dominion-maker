import type { CardName, LogEntry } from "../types/game-state";
import { CARDS } from "../data/cards";

/**
 * Player colors for consistent visual identification
 */
const PLAYER_COLORS = [
  "#3b82f6", // Blue
  "#ef4444", // Red
  "#10b981", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
] as const;

/**
 * Get unique color for each player using deterministic hash
 */
export function getPlayerColor(playerId: string): string {
  // Legacy hardcoded mappings for backwards compatibility
  const legacyMap: Record<string, string> = {
    human: "var(--color-human)",
    ai: "var(--color-ai)",
    player0: "var(--color-human)",
    player1: "var(--color-ai)",
    player2: "var(--color-player-3)",
    player3: "var(--color-player-4)",
    player4: "var(--color-player-5)",
  };

  if (legacyMap[playerId]) {
    return legacyMap[playerId];
  }

  // For dynamic player names, use hash-based color selection
  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = (hash << 5) - hash + playerId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % PLAYER_COLORS.length;
  return PLAYER_COLORS[index];
}

/**
 * Format player name for display with optional AI suffix
 */
export function formatPlayerName(
  playerId: string,
  isAI: boolean,
  options?: { capitalize?: boolean },
): string {
  const { capitalize = true } = options || {};

  let name = playerId;

  // Friendly names for special IDs
  if (playerId === "human") {
    name = "You";
  } else if (playerId === "player") {
    name = capitalize ? "Player" : "player";
  } else {
    // Keep the name as-is (e.g., "Nova", "ai", "Cipher")
    name = playerId;
  }

  // Add AI suffix if needed
  if (isAI && playerId !== "human") {
    name = `${name} (AI)`;
  }

  return name;
}

export function countVP(cards: CardName[]): number {
  return cards.reduce((vp, card) => {
    const { vp: cardVP } = CARDS[card];
    if (cardVP === "variable") {
      return vp + Math.floor(cards.length / 10);
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
export function aggregateLogEntries(
  log: LogEntry[],
): (LogEntry & { eventIds?: string[] })[] {
  if (log.length === 0) return [];

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
        children: [
          { type: "text", message: `${count}x` },
          ...aggregatedChildren,
        ],
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

  const result: (LogEntry & { eventIds?: string[] })[] = [];
  let i = 0;

  while (i < log.length) {
    const current = log[i];

    if (isAggregatable(current)) {
      const { entries, count } = collectConsecutive(i);
      result.push(count > 1 ? aggregateGroup(entries) : current);
      i += count;
    } else {
      result.push(current);
      i++;
    }
  }

  return result;
}
