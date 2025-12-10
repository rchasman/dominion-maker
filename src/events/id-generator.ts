import { engineLogger } from "../lib/logger";
/**
 * Event ID generation for causality tracking
 */

const eventCounterState = { value: 0 };

/**
 * Generate a unique event ID
 * Format: evt-{counter}
 */
export function generateEventId(): string {
  return `evt-${++eventCounterState.value}`;
}

/**
 * Reset the event counter (useful for testing or new games)
 */
export function resetEventCounter(): void {
  eventCounterState.value = 0;
}

const EVENT_ID_PREFIX_LENGTH = 4;

/**
 * Sync the event counter with existing events (for reconnect/undo)
 * Sets counter to the highest event number found in the event log
 */
export function syncEventCounter(events: Array<{ id?: string }>): void {
  const maxId = events.reduce((max, event) => {
    if (event.id && event.id.startsWith("evt-")) {
      const num = parseInt(event.id.slice(EVENT_ID_PREFIX_LENGTH), 10);
      return !isNaN(num) && num > max ? num : max;
    }
    return max;
  }, 0);

  eventCounterState.value = maxId;
  engineLogger.debug(
    `[id-generator] Synced counter to ${maxId} from ${events.length} events`,
  );
}
