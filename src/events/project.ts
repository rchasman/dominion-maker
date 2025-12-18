import type { GameState } from "../types/game-state";
import type { GameEvent } from "./types";
import { applyEvent } from "./apply";
import { buildLogFromEvents } from "./log-builder";

/**
 * Create an empty initial state.
 * This is the base state before any events are applied.
 */
export function createEmptyState(): GameState {
  return {
    turn: 0,
    phase: "action",
    activePlayer: "human",
    players: {},
    supply: {},
    trash: [],
    kingdomCards: [],
    actions: 0,
    buys: 0,
    coins: 0,
    pendingDecision: null,
    pendingDecisionEventId: null,
    gameOver: false,
    winner: null,
    log: [],
    turnHistory: [],
    playerOrder: [],
    activeEffects: [],
  };
}

/**
 * Project state from an event log.
 * Starting from empty state, applies all events in sequence.
 * Then builds a nested log structure from causal chains.
 */
export function projectState(events: GameEvent[]): GameState {
  const state = events.reduce(applyEvent, createEmptyState());

  // Rebuild log with causality nesting
  return {
    ...state,
    log: buildLogFromEvents(events),
  };
}

/**
 * Get events for a specific turn.
 * Useful for log display and undo granularity.
 */
export function getEventsForTurn(
  events: GameEvent[],
  turn: number,
): GameEvent[] {
  const result = events.reduce<{
    turnEvents: GameEvent[];
    currentTurn: number;
    inTargetTurn: boolean;
    done: boolean;
  }>(
    (acc, event) => {
      if (acc.done) return acc;

      const currentTurn =
        event.type === "TURN_STARTED" ? event.turn : acc.currentTurn;
      const inTargetTurn = currentTurn === turn;

      const turnEvents = inTargetTurn
        ? [...acc.turnEvents, event]
        : acc.turnEvents;

      const done =
        inTargetTurn && event.type === "TURN_STARTED" && currentTurn > turn;

      return { turnEvents, currentTurn, inTargetTurn, done };
    },
    { turnEvents: [], currentTurn: 0, inTargetTurn: false, done: false },
  );

  return result.turnEvents;
}

/**
 * Find the event index where a turn started.
 * Returns -1 if turn not found.
 */
export function findTurnStartIndex(events: GameEvent[], turn: number): number {
  return events.findIndex(e => e.type === "TURN_STARTED" && e.turn === turn);
}

/**
 * Count events by type (for debugging/analytics).
 */
export function countEventsByType(events: GameEvent[]): Record<string, number> {
  return events.reduce(
    (counts, event) => ({
      ...counts,
      [event.type]: (counts[event.type] || 0) + 1,
    }),
    {} as Record<string, number>,
  );
}
