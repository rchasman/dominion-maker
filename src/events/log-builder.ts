import type {
  GameEvent,
  CardDrawnEvent,
  CardDiscardedEvent,
  CardTrashedEvent,
  ActionsModifiedEvent,
  BuysModifiedEvent,
  CoinsModifiedEvent,
  PlayerId,
} from "./types";
import type { LogEntry, CardName } from "../types/game-state";
import { CARDS } from "../data/cards";

// Extended event type for aggregated card operations
type AggregatedCardEvent = (
  | CardDrawnEvent
  | CardDiscardedEvent
  | CardTrashedEvent
) & {
  cards: CardName[];
  cardCounts: Record<string, number>;
  count: number;
};

type MaybeAggregatedEvent = GameEvent | AggregatedCardEvent;

function isPlayerEvent(
  event: GameEvent,
): event is GameEvent & { playerId: PlayerId } {
  return "player" in event;
}

function isCardEvent(
  event: GameEvent,
): event is CardDrawnEvent | CardDiscardedEvent | CardTrashedEvent {
  return (
    event.type === "CARD_DRAWN" ||
    event.type === "CARD_DISCARDED" ||
    event.type === "CARD_TRASHED"
  );
}

/**
 * Build nested log entries from events using causality chains.
 * Root events become top-level entries, effects nest under their causes.
 * Aggregates consecutive identical card operations (draw/discard/trash).
 */
export function buildLogFromEvents(events: GameEvent[]): LogEntry[] {
  const aggregatedEvents = aggregateCardEvents(events);

  const { rootLogs } = aggregatedEvents.reduce<{
    logMap: Map<string, LogEntry>;
    rootLogs: LogEntry[];
    currentPlayer: string;
  }>(
    (acc, event) => {
      // Track current player from TURN_STARTED events
      const currentPlayer =
        event.type === "TURN_STARTED" ? event.playerId : acc.currentPlayer;

      const logEntry = eventToLogEntry(event, currentPlayer);
      const eventId = event.id;
      if (!logEntry || !eventId)
        return { ...acc, currentPlayer: currentPlayer };

      const newLogMap = new Map(acc.logMap).set(eventId, logEntry);

      if (event.causedBy) {
        // Find nearest visible ancestor (skip over filtered events like DECISION_RESOLVED)
        const findVisibleParent = (
          startParentId: string,
        ): LogEntry | undefined => {
          const checkParent = acc.logMap.get(startParentId);
          if (checkParent) return checkParent;

          const parentEvent = events.find(e => e.id === startParentId);
          if (!parentEvent || !parentEvent.causedBy) return undefined;

          return findVisibleParent(parentEvent.causedBy);
        };

        const parent = findVisibleParent(event.causedBy);

        if (parent) {
          parent.children = [...(parent.children || []), logEntry];
          return {
            logMap: newLogMap,
            rootLogs: acc.rootLogs,
            currentPlayer: currentPlayer,
          };
        }
        return {
          logMap: newLogMap,
          rootLogs: [...acc.rootLogs, logEntry],
          currentPlayer: currentPlayer,
        };
      }

      return {
        logMap: newLogMap,
        rootLogs: [...acc.rootLogs, logEntry],
        currentPlayer: currentPlayer,
      };
    },
    { logMap: new Map(), rootLogs: [], currentPlayer: "human" },
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
    return current.playerId === next.playerId && next.causedBy === current.causedBy;
  };

  const collectConsecutive = (
    startIndex: number,
  ): { events: GameEvent[]; count: number } => {
    const consecutiveCount = events
      .slice(startIndex + 1)
      .findIndex(next => !canMatchNext(events[startIndex], next));

    const count =
      consecutiveCount === -1
        ? events.length - startIndex
        : consecutiveCount + 1;

    return { events: events.slice(startIndex, startIndex + count), count };
  };

  const aggregateGroup = (
    groupEvents: (CardDrawnEvent | CardDiscardedEvent | CardTrashedEvent)[],
  ): AggregatedCardEvent => {
    const [first] = groupEvents;
    const cards = groupEvents.map(e => e.card);
    const initial: Record<string, number> = {};
    const cardCounts = cards.reduce(
      (acc, card) => ({
        ...acc,
        [card]: (acc[card] || 0) + 1,
      }),
      initial,
    );

    return {
      ...first,
      card: cards[0],
      cards,
      cardCounts,
      count: cards.length,
    };
  };

  const processEvents = (
    index: number,
    acc: MaybeAggregatedEvent[],
  ): MaybeAggregatedEvent[] => {
    if (index >= events.length) return acc;

    const event = events[index];

    if (isCardEvent(event)) {
      const { events: groupEvents, count } = collectConsecutive(index);
      return processEvents(index + count, [
        ...acc,
        aggregateGroup(
          groupEvents as (
            | CardDrawnEvent
            | CardDiscardedEvent
            | CardTrashedEvent
          )[],
        ),
      ]);
    }

    return processEvents(index + 1, [...acc, event]);
  };

  return processEvents(0, []);
}

function isAggregatedEvent(
  event: MaybeAggregatedEvent,
): event is AggregatedCardEvent {
  return "cards" in event && "cardCounts" in event && "count" in event;
}

/**
 * Convert CARD_PLAYED event to log entry
 */
function cardPlayedToLogEntry(
  event: MaybeAggregatedEvent & { type: "CARD_PLAYED"; card: CardName },
): LogEntry | null {
  const cardDef = CARDS[event.card];
  const isTreasure = cardDef.types.includes("treasure");
  const isAction = cardDef.types.includes("action");

  if (isTreasure) {
    return {
      type: "play-treasure",
      playerId: event.playerId,
      card: event.card,
      coins: cardDef.coins || 0,
      eventId: event.id,
    };
  }

  if (isAction) {
    return {
      type: "play-action",
      playerId: event.playerId,
      card: event.card,
      eventId: event.id,
    };
  }
  return null;
}

/**
 * Convert CARD_DRAWN event to log entry
 */
function cardDrawnToLogEntry(event: MaybeAggregatedEvent): LogEntry {
  if (isAggregatedEvent(event)) {
    return {
      type: "draw-cards",
      playerId: event.playerId,
      count: event.count,
      cards: event.cards,
      cardCounts: event.cardCounts,
      eventId: event.id,
    };
  }
  return {
    type: "draw-cards",
    playerId: (event as CardDrawnEvent).playerId,
    count: 1,
    cards: [(event as CardDrawnEvent).card],
    eventId: event.id,
  };
}

/**
 * Convert CARD_DISCARDED event to log entry
 */
function cardDiscardedToLogEntry(event: MaybeAggregatedEvent): LogEntry {
  if (isAggregatedEvent(event)) {
    return {
      type: "discard-cards",
      playerId: event.playerId,
      count: event.count,
      cards: event.cards,
      cardCounts: event.cardCounts,
      eventId: event.id,
    };
  }
  return {
    type: "discard-cards",
    playerId: (event as CardDiscardedEvent).playerId,
    count: 1,
    cards: [(event as CardDiscardedEvent).card],
    eventId: event.id,
  };
}

/**
 * Convert CARD_TRASHED event to log entry
 */
function cardTrashedToLogEntry(event: MaybeAggregatedEvent): LogEntry {
  if (isAggregatedEvent(event)) {
    return {
      type: "trash-card",
      playerId: event.playerId,
      card: event.cards[0],
      cards: event.cards,
      count: event.count,
      eventId: event.id,
    };
  }
  return {
    type: "trash-card",
    playerId: (event as CardTrashedEvent).playerId,
    card: (event as CardTrashedEvent).card,
    eventId: event.id,
  };
}

/**
 * Convert CARD_GAINED event to log entry
 */
function cardGainedToLogEntry(
  event: MaybeAggregatedEvent & { type: "CARD_GAINED"; card: CardName },
): LogEntry {
  const cardDef = CARDS[event.card];
  const isBuy = !event.causedBy;

  if (isBuy) {
    return {
      type: "buy-card",
      playerId: event.playerId,
      card: event.card,
      vp: typeof cardDef.vp === "number" ? cardDef.vp : undefined,
      eventId: event.id,
      children: [
        {
          type: "gain-card",
          playerId: event.playerId,
          card: event.card,
          eventId: event.id,
        },
      ],
    };
  }

  return {
    type: "gain-card",
    playerId: event.playerId,
    card: event.card,
    eventId: event.id,
  };
}

/**
 * Convert CARD_RETURNED_TO_HAND event to log entry
 */
function cardReturnedToHandToLogEntry(
  event: MaybeAggregatedEvent & {
    type: "CARD_RETURNED_TO_HAND";
    card: CardName;
  },
): LogEntry | null {
  const cardDef = CARDS[event.card];
  const isTreasure = cardDef.types.includes("treasure");

  if (isTreasure && event.from === "inPlay") {
    return {
      type: "unplay-treasure",
      playerId: event.playerId,
      card: event.card,
      coins: cardDef.coins || 0,
      eventId: event.id,
    };
  }
  return null;
}

/**
 * Convert resource modification events to log entries
 */
function resourceModifiedToLogEntry(
  event: ActionsModifiedEvent | BuysModifiedEvent | CoinsModifiedEvent,
  currentPlayer: string,
): LogEntry | null {
  const typeMap = {
    ACTIONS_MODIFIED: {
      positive: "get-actions" as const,
      negative: "use-actions" as const,
    },
    BUYS_MODIFIED: {
      positive: "get-buys" as const,
      negative: "use-buys" as const,
    },
    COINS_MODIFIED: {
      positive: "get-coins" as const,
      negative: "spend-coins" as const,
    },
  };

  if (event.delta > 0) {
    return {
      type: typeMap[event.type].positive,
      playerId: currentPlayer,
      count: event.delta,
      eventId: event.id,
    };
  }

  if (event.delta < 0) {
    return {
      type: typeMap[event.type].negative,
      playerId: currentPlayer,
      count: -event.delta,
      eventId: event.id,
    };
  }

  return null;
}

/**
 * Convert card-related events to log entries
 */
function cardEventToLogEntry(event: MaybeAggregatedEvent): LogEntry | null {
  switch (event.type) {
    case "CARD_PLAYED":
      return cardPlayedToLogEntry(event);
    case "CARD_DRAWN":
      return cardDrawnToLogEntry(event);
    case "CARD_DISCARDED":
      return cardDiscardedToLogEntry(event);
    case "CARD_TRASHED":
      return cardTrashedToLogEntry(event);
    case "CARD_GAINED":
      return cardGainedToLogEntry(event);
    case "DECK_SHUFFLED":
      return {
        type: "shuffle-deck",
        playerId: event.playerId,
        eventId: event.id,
      };
    case "CARD_RETURNED_TO_HAND":
      return cardReturnedToHandToLogEntry(event);
    default:
      return null;
  }
}

/**
 * Convert game flow events to log entries
 */
function gameFlowEventToLogEntry(
  event: MaybeAggregatedEvent,
  currentPlayer: string,
): LogEntry | null {
  switch (event.type) {
    case "TURN_STARTED":
      return {
        type: "turn-start",
        turn: event.turn,
        playerId: event.playerId,
        eventId: event.id,
      };
    case "PHASE_CHANGED":
      return {
        type: "phase-change",
        playerId: currentPlayer,
        phase: event.phase,
        eventId: event.id,
      };
    case "GAME_ENDED":
      return {
        type: "game-over",
        scores: event.scores,
        winnerId: event.winner || currentPlayer,
        eventId: event.id,
      };
    case "TURN_ENDED":
      return { type: "turn-end", playerId: event.playerId, eventId: event.id };
    default:
      return null;
  }
}

/**
 * Convert a single event to a log entry (without nesting).
 */
function eventToLogEntry(
  event: MaybeAggregatedEvent,
  currentPlayer: string,
): LogEntry | null {
  // Try card events
  const cardLog = cardEventToLogEntry(event);
  if (cardLog) return cardLog;

  // Try game flow events
  const flowLog = gameFlowEventToLogEntry(event, currentPlayer);
  if (flowLog) return flowLog;

  // Try resource events
  if (
    event.type === "ACTIONS_MODIFIED" ||
    event.type === "BUYS_MODIFIED" ||
    event.type === "COINS_MODIFIED"
  ) {
    return resourceModifiedToLogEntry(event, currentPlayer);
  }

  // All other events don't show in log
  return null;
}
