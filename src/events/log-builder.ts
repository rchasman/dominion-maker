import type { GameEvent, CardDrawnEvent, CardDiscardedEvent, CardTrashedEvent } from "./types";
import type { LogEntry, CardName } from "../types/game-state";
import { CARDS } from "../data/cards";

// Extended event type for aggregated card operations
type AggregatedCardEvent = (CardDrawnEvent | CardDiscardedEvent | CardTrashedEvent) & {
  cards: CardName[];
  cardCounts: Record<string, number>;
  count: number;
};

type MaybeAggregatedEvent = GameEvent | AggregatedCardEvent;

function isPlayerEvent(event: GameEvent): event is GameEvent & { player: string } {
  return "player" in event;
}

function isCardEvent(event: GameEvent): event is CardDrawnEvent | CardDiscardedEvent | CardTrashedEvent {
  return event.type === "CARD_DRAWN" || event.type === "CARD_DISCARDED" || event.type === "CARD_TRASHED";
}

/**
 * Build nested log entries from events using causality chains.
 * Root events become top-level entries, effects nest under their causes.
 * Aggregates consecutive identical card operations (draw/discard/trash).
 */
export function buildLogFromEvents(events: GameEvent[], currentPlayer: string = "human"): LogEntry[] {
  const aggregatedEvents = aggregateCardEvents(events);

  const { rootLogs } = aggregatedEvents.reduce<{
    logMap: Map<string, LogEntry>;
    rootLogs: LogEntry[];
  }>(
    (acc, event) => {
      const logEntry = eventToLogEntry(event, currentPlayer);
      const eventId = event.id;
      if (!logEntry || !eventId) return acc;

      const newLogMap = new Map(acc.logMap).set(eventId, logEntry);

      if (event.causedBy) {
        const parent = acc.logMap.get(event.causedBy);
        if (parent) {
          parent.children = [...(parent.children || []), logEntry];
          return { logMap: newLogMap, rootLogs: acc.rootLogs };
        }
        return { logMap: newLogMap, rootLogs: [...acc.rootLogs, logEntry] };
      }

      return { logMap: newLogMap, rootLogs: [...acc.rootLogs, logEntry] };
    },
    { logMap: new Map(), rootLogs: [] }
  );

  return rootLogs;
}

/**
 * Aggregate consecutive card events (CARD_DRAWN, CARD_DISCARDED, CARD_TRASHED)
 * Splits on different event types, shuffles, or different players/sources.
 * Groups cards by name and shows counts (e.g., "Copper x3, Estate x2")
 */
function aggregateCardEvents(events: GameEvent[]): MaybeAggregatedEvent[] {
  const canMatchNext = (current: GameEvent, next: GameEvent): boolean => {
    if (next.type === "DECK_SHUFFLED") return false;
    if (next.type !== current.type) return false;
    if (!isPlayerEvent(current) || !isPlayerEvent(next)) return false;
    return current.player === next.player && next.causedBy === current.causedBy;
  };

  const collectConsecutive = (startIndex: number): { events: GameEvent[]; count: number } => {
    const consecutiveCount = events.slice(startIndex + 1)
      .findIndex((next) => !canMatchNext(events[startIndex], next));

    const count = consecutiveCount === -1
      ? events.length - startIndex
      : consecutiveCount + 1;

    return { events: events.slice(startIndex, startIndex + count), count };
  };

  const aggregateGroup = (groupEvents: (CardDrawnEvent | CardDiscardedEvent | CardTrashedEvent)[]): AggregatedCardEvent => {
    const [first] = groupEvents;
    const cards = groupEvents.map(e => e.card);
    const initial: Record<string, number> = {};
    const cardCounts = cards.reduce((acc, card) => ({
      ...acc,
      [card]: (acc[card] || 0) + 1
    }), initial);

    return {
      ...first,
      card: cards[0],
      cards,
      cardCounts,
      count: cards.length,
    };
  };

  const result: MaybeAggregatedEvent[] = [];
  let i = 0;

  while (i < events.length) {
    const event = events[i];

    if (isCardEvent(event)) {
      const { events: groupEvents, count } = collectConsecutive(i);
      result.push(aggregateGroup(groupEvents as (CardDrawnEvent | CardDiscardedEvent | CardTrashedEvent)[]));
      i += count;
    } else {
      result.push(event);
      i++;
    }
  }

  return result;
}

function isAggregatedEvent(event: MaybeAggregatedEvent): event is AggregatedCardEvent {
  return "cards" in event && "cardCounts" in event && "count" in event;
}

/**
 * Convert a single event to a log entry (without nesting).
 */
function eventToLogEntry(event: MaybeAggregatedEvent, currentPlayer: string): LogEntry | null {
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
      if (isAggregatedEvent(event)) {
        return { type: "draw-cards", player: event.player, count: event.count, cards: event.cards, cardCounts: event.cardCounts, eventId: event.id };
      }
      return { type: "draw-cards", player: event.player, count: 1, cards: [event.card], eventId: event.id };
    }

    case "CARD_DISCARDED": {
      if (isAggregatedEvent(event)) {
        return { type: "discard-cards", player: event.player, count: event.count, cards: event.cards, cardCounts: event.cardCounts, eventId: event.id };
      }
      return { type: "discard-cards", player: event.player, count: 1, cards: [event.card], eventId: event.id };
    }

    case "CARD_TRASHED": {
      if (isAggregatedEvent(event)) {
        return { type: "trash-card", player: event.player, card: event.cards[0], cards: event.cards, count: event.count, eventId: event.id };
      }
      return { type: "trash-card", player: event.player, card: event.card, eventId: event.id };
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
