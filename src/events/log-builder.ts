import type { GameEvent } from "./types";
import type { LogEntry } from "../types/game-state";
import { CARDS } from "../data/cards";

/**
 * Build nested log entries from events using causality chains.
 * Root events become top-level entries, effects nest under their causes.
 * Aggregates consecutive identical card operations (draw/discard/trash).
 */
export function buildLogFromEvents(events: GameEvent[], currentPlayer: string = "human"): LogEntry[] {
  // First pass: aggregate consecutive card events
  const aggregatedEvents = aggregateCardEvents(events);

  const logMap = new Map<string, LogEntry>();
  const rootLogs: LogEntry[] = [];

  for (const event of aggregatedEvents) {
    const logEntry = eventToLogEntry(event, currentPlayer);
    if (!logEntry || !event.id) continue;

    logMap.set(event.id, logEntry);

    if (event.causedBy) {
      // This is an effect - nest it under its cause
      const parent = logMap.get(event.causedBy);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(logEntry);
      } else {
        // Parent not found yet, add as root (shouldn't happen if events are ordered)
        rootLogs.push(logEntry);
      }
    } else {
      // Root cause - add as top-level entry
      rootLogs.push(logEntry);
    }
  }

  return rootLogs;
}

/**
 * Aggregate consecutive card events (CARD_DRAWN, CARD_DISCARDED, CARD_TRASHED)
 * Splits on different event types, shuffles, or different players/sources.
 * Groups cards by name and shows counts (e.g., "Copper x3, Estate x2")
 */
function aggregateCardEvents(events: GameEvent[]): GameEvent[] {
  const result: GameEvent[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i];

    // Only aggregate drawable/discardable card events
    if (event.type === "CARD_DRAWN" || event.type === "CARD_DISCARDED" || event.type === "CARD_TRASHED") {
      const cards: string[] = [event.card];
      const player = event.player;
      const causedBy = event.causedBy;
      let j = i + 1;

      // Collect consecutive same-type events (same player, same causality)
      while (j < events.length) {
        const next = events[j];

        // Stop if we hit a shuffle event (splits aggregation)
        if (next.type === "DECK_SHUFFLED") break;

        // Stop if different type
        if (next.type !== event.type) break;

        // Stop if different player or causality
        if ((next as { player?: string }).player !== player || next.causedBy !== causedBy) break;

        // Same type, aggregate it (ignore source - aggregate hand+inPlay discards together)
        cards.push((next as { card: string }).card);
        j++;
      }

      // Count cards by name for compact display
      const cardCounts = new Map<string, number>();
      for (const card of cards) {
        cardCounts.set(card, (cardCounts.get(card) || 0) + 1);
      }

      // Create aggregated log event with card counts
      result.push({
        ...event,
        card: cards[0], // Keep for type compatibility
        cards, // Full array for compatibility
        cardCounts: Object.fromEntries(cardCounts), // Map of card name -> count
        count: cards.length,
      } as unknown as GameEvent);

      i = j; // Skip all aggregated events
    } else {
      // Not a card event, pass through as-is
      result.push(event);
      i++;
    }
  }

  return result;
}

/**
 * Convert a single event to a log entry (without nesting).
 */
function eventToLogEntry(event: GameEvent, currentPlayer: string): LogEntry | null {
  switch (event.type) {
    case "TURN_STARTED":
      return { type: "turn-start", turn: event.turn, player: event.player, eventId: event.id };

    case "PHASE_CHANGED":
      return { type: "phase-change", player: currentPlayer, phase: event.phase, eventId: event.id };

    case "CARD_PLAYED": {
      const cardDef = CARDS[event.card];
      const isTreasure = cardDef.types.includes("treasure");
      const isAction = cardDef.types.includes("action");

      if (isTreasure) {
        return { type: "play-treasure", player: event.player, card: event.card, coins: cardDef.coins || 0, eventId: event.id };
      } else if (isAction) {
        return { type: "play-action", player: event.player, card: event.card, eventId: event.id };
      }
      return null;
    }

    case "CARD_DRAWN": {
      // Check if this is an aggregated event (has cardCounts from aggregation)
      const aggregated = event as typeof event & { cardCounts?: Record<string, number>; cards?: string[]; count?: number };
      const cardCounts = aggregated.cardCounts;
      const cards = (aggregated.cards || [event.card]) as typeof event.card[];
      const count = aggregated.count || 1;
      return { type: "draw-cards", player: event.player, count, cards, cardCounts, eventId: event.id };
    }

    case "CARD_DISCARDED": {
      // Check if this is an aggregated event
      const aggregated = event as typeof event & { cardCounts?: Record<string, number>; cards?: string[]; count?: number };
      const cardCounts = aggregated.cardCounts;
      const cards = (aggregated.cards || [event.card]) as typeof event.card[];
      const count = aggregated.count || 1;
      return { type: "discard-cards", player: event.player, count, cards, cardCounts, eventId: event.id };
    }

    case "CARD_TRASHED": {
      // Check if this is an aggregated event
      const aggregated = event as typeof event & { cards?: string[]; count?: number };
      const cards = (aggregated.cards || [event.card]) as typeof event.card[];
      const count = aggregated.count || 1;
      if (count === 1) {
        return { type: "trash-card", player: event.player, card: event.card, eventId: event.id };
      } else {
        return { type: "trash-card", player: event.player, card: cards[0] as typeof event.card, cards, count, eventId: event.id };
      }
    }

    case "CARD_GAINED": {
      const cardDef = CARDS[event.card];
      const isBuy = !event.causedBy;

      if (isBuy) {
        // For buys, create a buy-card log with a nested gain-card child
        return {
          type: "buy-card",
          player: event.player,
          card: event.card,
          vp: typeof cardDef.vp === "number" ? cardDef.vp : undefined,
          eventId: event.id,
          children: [{
            type: "gain-card",
            player: event.player,
            card: event.card,
            eventId: event.id
          }]
        };
      } else {
        return { type: "gain-card", player: event.player, card: event.card, eventId: event.id };
      }
    }

    case "DECK_SHUFFLED":
      return { type: "shuffle-deck", player: event.player, eventId: event.id };

    case "CARD_RETURNED_TO_HAND": {
      const cardDef = CARDS[event.card];
      const isTreasure = cardDef.types.includes("treasure");

      if (isTreasure && event.from === "inPlay") {
        return { type: "unplay-treasure", player: event.player, card: event.card, coins: cardDef.coins || 0, eventId: event.id };
      }
      return null;
    }

    case "ACTIONS_MODIFIED":
      if (event.delta > 0) {
        return { type: "get-actions", player: currentPlayer, count: event.delta, eventId: event.id };
      } else if (event.delta < 0) {
        return { type: "use-actions", player: currentPlayer, count: -event.delta, eventId: event.id };
      }
      return null;

    case "BUYS_MODIFIED":
      if (event.delta > 0) {
        return { type: "get-buys", player: currentPlayer, count: event.delta, eventId: event.id };
      } else if (event.delta < 0) {
        return { type: "use-buys", player: currentPlayer, count: -event.delta, eventId: event.id };
      }
      return null;

    case "COINS_MODIFIED":
      if (event.delta > 0) {
        return { type: "get-coins", player: currentPlayer, count: event.delta, eventId: event.id };
      } else if (event.delta < 0) {
        return { type: "spend-coins", player: currentPlayer, count: -event.delta, eventId: event.id };
      }
      return null;

    case "GAME_ENDED":
      return {
        type: "game-over",
        humanVP: event.scores.human || event.scores.player0 || 0,
        aiVP: event.scores.ai || event.scores.player1 || 0,
        winner: event.winner || currentPlayer,
        eventId: event.id,
      };

    case "TURN_ENDED":
      return { type: "turn-end", player: event.player, eventId: event.id };

    // These don't show in log
    case "GAME_INITIALIZED":
    case "INITIAL_DECK_DEALT":
    case "INITIAL_HAND_DRAWN":
    case "CARD_REVEALED":
    case "CARD_PUT_ON_DECK":
    case "DECISION_REQUIRED":
    case "DECISION_RESOLVED":
    case "UNDO_REQUESTED":
    case "UNDO_APPROVED":
    case "UNDO_DENIED":
    case "UNDO_EXECUTED":
      return null;

    default:
      return null;
  }
}
