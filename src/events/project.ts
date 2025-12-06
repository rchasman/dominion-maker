import type { GameState } from "../types/game-state";
import type { GameEvent } from "./types";
import { applyEvent } from "./apply";

/**
 * Create an empty initial state.
 * This is the base state before any events are applied.
 */
export function createEmptyState(): GameState {
  return {
    turn: 0,
    phase: "action",
    subPhase: null,
    activePlayer: "human",
    players: {},
    supply: {},
    trash: [],
    kingdomCards: [],
    actions: 0,
    buys: 0,
    coins: 0,
    pendingDecision: null,
    gameOver: false,
    winner: null,
    log: [],
    turnHistory: [],
    playerOrder: [],
  };
}

/**
 * Project state from an event log.
 * Starting from empty state, applies all events in sequence.
 */
export function projectState(events: GameEvent[]): GameState {
  return events.reduce(applyEvent, createEmptyState());
}

/**
 * Project state up to a specific event index (for time travel).
 */
export function projectStateAt(events: GameEvent[], index: number): GameState {
  return projectState(events.slice(0, index + 1));
}

/**
 * Get events for a specific turn.
 * Useful for log display and undo granularity.
 */
export function getEventsForTurn(events: GameEvent[], turn: number): GameEvent[] {
  const turnEvents: GameEvent[] = [];
  let currentTurn = 0;
  let inTargetTurn = false;

  for (const event of events) {
    if (event.type === "TURN_STARTED") {
      currentTurn = event.turn;
      inTargetTurn = currentTurn === turn;
    }

    if (inTargetTurn) {
      turnEvents.push(event);
    }

    if (inTargetTurn && event.type === "TURN_STARTED" && currentTurn > turn) {
      break;
    }
  }

  return turnEvents;
}

/**
 * Find the event index where a turn started.
 * Returns -1 if turn not found.
 */
export function findTurnStartIndex(events: GameEvent[], turn: number): number {
  return events.findIndex(
    e => e.type === "TURN_STARTED" && e.turn === turn
  );
}

/**
 * Count events by type (for debugging/analytics).
 */
export function countEventsByType(events: GameEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.type] = (counts[event.type] || 0) + 1;
  }
  return counts;
}
