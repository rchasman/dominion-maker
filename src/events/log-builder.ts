import type { GameEvent } from "./types";
import type { LogEntry } from "../types/game-state";

/**
 * Build nested log entries from events using causality chains.
 * Root events become top-level entries, effects nest under their causes.
 */
export function buildLogFromEvents(events: GameEvent[]): LogEntry[] {
  const logMap = new Map<string, LogEntry>();
  const rootLogs: LogEntry[] = [];

  for (const event of events) {
    const logEntry = eventToLogEntry(event);
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
function eventToLogEntry(event: GameEvent): LogEntry | null {
  switch (event.type) {
    case "TURN_STARTED":
      return { type: "turn-start", turn: event.turn, player: event.player };

    case "PHASE_CHANGED":
      return null; // Don't show phase changes in log

    case "CARD_PLAYED":
      return { type: "play-action", player: event.player, card: event.card };

    case "CARDS_DRAWN":
      return { type: "draw-cards", player: event.player, count: event.cards.length, cards: event.cards };

    case "CARDS_DISCARDED":
      if (event.cards.length > 0) {
        return { type: "discard-cards", player: event.player, count: event.cards.length, cards: event.cards };
      }
      return null;

    case "CARDS_TRASHED":
      // Create separate entry for each trashed card
      return event.cards.length > 0
        ? { type: "trash-card", player: event.player, card: event.cards[0] }
        : null;

    case "CARD_GAINED":
      return { type: "gain-card", player: event.player, card: event.card };

    case "DECK_SHUFFLED":
      return { type: "shuffle-deck", player: event.player };

    case "ACTIONS_MODIFIED":
      if (event.delta > 0) {
        // Resource events don't have player, will be nested under the card that caused them
        return { type: "get-actions", player: "human", count: event.delta };
      }
      return null; // Don't show action costs

    case "BUYS_MODIFIED":
      if (event.delta > 0) {
        return { type: "get-buys", player: "human", count: event.delta };
      }
      return null;

    case "COINS_MODIFIED":
      if (event.delta > 0) {
        return { type: "get-coins", player: "human", count: event.delta };
      }
      return null;

    case "GAME_ENDED":
      return {
        type: "game-over",
        humanVP: event.scores.human || 0,
        aiVP: event.scores.ai || 0,
        winner: event.winner || "human",
      };

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
