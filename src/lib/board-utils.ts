import type { CardName, LogEntry } from "../types/game-state";
import { CARDS } from "../data/cards";

/**
 * Get unique color for each player
 */
export function getPlayerColor(playerId: string): string {
  const colorMap: Record<string, string> = {
    "human": "var(--color-human)",
    "ai": "var(--color-ai)",
    "player0": "var(--color-human)",
    "player1": "var(--color-ai)",
    "player2": "var(--color-player-3)",
    "player3": "var(--color-player-4)",
    "player4": "var(--color-player-5)",
  };
  return colorMap[playerId] || "var(--color-text-secondary)";
}

export function countVP(cards: CardName[]): number {
  let vp = 0;
  for (const card of cards) {
    const def = CARDS[card];
    if (def.vp === "variable") {
      vp += Math.floor(cards.length / 10);
    } else if (typeof def.vp === "number") {
      vp += def.vp;
    }
  }
  return vp;
}

export function getAllCards(player: { deck: CardName[]; hand: CardName[]; discard: CardName[]; inPlay: CardName[] }): CardName[] {
  return [...player.deck, ...player.hand, ...player.discard, ...player.inPlay];
}

// Aggregate consecutive identical log entries for display
// Returns aggregated entries with eventIds preserved (array of eventIds for grouped entries)
export function aggregateLogEntries(log: LogEntry[]): (LogEntry & { eventIds?: string[] })[] {
  if (log.length === 0) return [];

  const result: (LogEntry & { eventIds?: string[] })[] = [];
  let i = 0;

  while (i < log.length) {
    const current = log[i];

    // Aggregate consecutive identical entries for groupable types
    // NOT play-action since each action has unique effects (different draws, etc)
    if (
      current.type === "play-treasure" ||
      current.type === "unplay-treasure" ||
      current.type === "buy-card" ||
      current.type === "gain-card" ||
      current.type === "discard-cards" ||
      current.type === "draw-cards"
    ) {
      // Count consecutive identical entries
      let count = 1;
      let totalCoins = (current.type === "play-treasure" || current.type === "unplay-treasure") ? current.coins : 0;
      let totalVP = current.type === "buy-card" && current.vp !== undefined ? current.vp : 0;
      let totalCount = (current.type === "discard-cards" || current.type === "draw-cards") ? current.count : 0;
      const allCards: CardName[] = [];
      const allChildren: LogEntry[] = [];
      const eventIds: string[] = [];

      // Collect cards from first entry (for discard/draw)
      if ((current.type === "discard-cards" || current.type === "draw-cards") && current.cards) {
        allCards.push(...current.cards);
      }

      // Collect eventId from first entry
      if (current.eventId) {
        eventIds.push(current.eventId);
      }

      // Collect children from first entry
      if (current.children) {
        allChildren.push(...(current.children as LogEntry[]));
      }

      // Look ahead for matching entries
      while (i + count < log.length) {
        const next = log[i + count];

        // Check if next entry matches current one
        let matches = false;

        if (next.type === current.type && "player" in next && "player" in current && next.player === current.player) {
          // For entries with single card (play-treasure, buy-card, gain-card), must match card
          if ("card" in next && "card" in current) {
            matches = next.card === current.card;
          }
          // For entries with multiple cards (discard-cards, draw-cards), just match type and player
          else if (current.type === "discard-cards" || current.type === "draw-cards") {
            matches = true;
          }
        }

        if (!matches) break;

        // Collect eventId from matched entry
        if (next.eventId) {
          eventIds.push(next.eventId);
        }

        // Aggregate values
        if (next.type === "play-treasure" || next.type === "unplay-treasure") {
          totalCoins += next.coins;
        }
        if (next.type === "buy-card" && next.vp !== undefined) {
          totalVP += next.vp;
        }
        if (next.type === "discard-cards" || next.type === "draw-cards") {
          totalCount += next.count;
          if (next.cards) {
            allCards.push(...next.cards);
          }
        }

        // Collect children from subsequent entries
        if (next.children) {
          allChildren.push(...(next.children as LogEntry[]));
        }

        count++;
      }

      // Create aggregated entry
      if (count > 1) {
        // Recursively aggregate children
        const aggregatedChildren = allChildren.length > 0 ? aggregateLogEntries(allChildren) : [];

        if (current.type === "play-treasure") {
          result.push({
            ...current,
            coins: totalCoins,
            children: count > 1
              ? [{ type: "text", message: `${count}x` }, ...aggregatedChildren]
              : aggregatedChildren,
            eventIds, // Array of all eventIds in this group
          });
        } else if (current.type === "unplay-treasure") {
          result.push({
            ...current,
            coins: totalCoins,
            children: count > 1
              ? [{ type: "text", message: `${count}x` }, ...aggregatedChildren]
              : aggregatedChildren,
            eventIds, // Array of all eventIds in this group
          });
        } else if (current.type === "buy-card") {
          result.push({
            ...current,
            vp: totalVP !== 0 ? totalVP : undefined,
            children: [
              { type: "text", message: `${count}x` },
              ...aggregatedChildren,
            ],
            eventIds, // Array of all eventIds in this group
          });
        } else if (current.type === "discard-cards") {
          result.push({
            ...current,
            count: totalCount,
            cards: allCards.length > 0 ? allCards : undefined,
            eventIds, // Array of all eventIds in this group
          });
        } else if (current.type === "draw-cards") {
          result.push({
            ...current,
            count: totalCount,
            cards: allCards.length > 0 ? allCards : undefined,
            eventIds, // Array of all eventIds in this group
          });
        } else {
          // gain-card
          result.push({
            ...current,
            children: [
              { type: "text", message: `${count}x` },
              ...aggregatedChildren,
            ],
            eventIds, // Array of all eventIds in this group
          });
        }
      } else {
        result.push(current);
      }

      i += count;
    } else {
      // Don't aggregate other entry types
      result.push(current);
      i++;
    }
  }

  return result;
}
