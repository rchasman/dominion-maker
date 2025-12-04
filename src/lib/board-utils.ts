import type { CardName, LogEntry } from "../types/game-state";
import { CARDS } from "../data/cards";

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
export function aggregateLogEntries(log: LogEntry[]): LogEntry[] {
  if (log.length === 0) return [];

  const result: LogEntry[] = [];
  let i = 0;

  while (i < log.length) {
    const current = log[i];

    // Only aggregate play-treasure, buy-card, and gain-card entries
    // NOT play-action since each action has unique effects (different draws, etc)
    if (
      current.type === "play-treasure" ||
      current.type === "buy-card" ||
      current.type === "gain-card"
    ) {
      // Count consecutive identical entries
      let count = 1;
      let totalCoins = current.type === "play-treasure" ? current.coins : 0;
      let totalVP = current.type === "buy-card" && current.vp !== undefined ? current.vp : 0;
      const allChildren: LogEntry[] = [];

      // Collect children from first entry
      if (current.children) {
        allChildren.push(...(current.children as LogEntry[]));
      }

      // Look ahead for matching entries
      while (i + count < log.length) {
        const next = log[i + count];

        // Check if next entry matches current one
        const matches =
          next.type === current.type &&
          ("player" in next && "player" in current && next.player === current.player) &&
          ("card" in next && "card" in current && next.card === current.card);

        if (!matches) break;

        // Aggregate values
        if (next.type === "play-treasure") {
          totalCoins += next.coins;
        }
        if (next.type === "buy-card" && next.vp !== undefined) {
          totalVP += next.vp;
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
            children: [{ type: "text", message: `${count}x` }],
          });
        } else if (current.type === "buy-card") {
          result.push({
            ...current,
            vp: totalVP !== 0 ? totalVP : undefined,
            children: [
              { type: "text", message: `${count}x` },
              ...aggregatedChildren,
            ],
          });
        } else {
          // gain-card
          result.push({
            ...current,
            children: [
              { type: "text", message: `${count}x` },
              ...aggregatedChildren,
            ],
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
