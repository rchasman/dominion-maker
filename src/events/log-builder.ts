import type { GameEvent } from "./types";
import type { LogEntry, Player } from "../types/game-state";
import { CARDS } from "../data/cards";

/**
 * Build nested log entries from events using causality chains.
 * Root events become top-level entries, effects nest under their causes.
 * This replaces the flat log building in applyEvent.
 */
export function buildLogFromEvents(events: GameEvent[], currentPlayer: Player = "human"): LogEntry[] {
  const logMap = new Map<string, LogEntry>();
  const rootLogs: LogEntry[] = [];

  for (const event of events) {
    const logEntry = eventToLogEntry(event, currentPlayer);
    if (!logEntry) continue;

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
 * Convert a single event to a log entry (without nesting).
 */
function eventToLogEntry(event: GameEvent, currentPlayer: Player): LogEntry | null {
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

    case "CARDS_DRAWN":
      return { type: "draw-cards", player: event.player, count: event.cards.length, cards: event.cards, eventId: event.id };

    case "CARDS_DISCARDED":
      if (event.cards.length > 0) {
        return { type: "discard-cards", player: event.player, count: event.cards.length, cards: event.cards, eventId: event.id };
      }
      return null;

    case "CARDS_TRASHED":
      // Create log entry for first card (in apply.ts we create separate entries)
      return event.cards.length > 0
        ? { type: "trash-card", player: event.player, card: event.cards[0], eventId: event.id }
        : null;

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
    case "CARDS_REVEALED":
    case "CARDS_PUT_ON_DECK":
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
