import { engineLogger } from "../lib/logger";
/**
 * Event ID generation for causality tracking
 */

let eventCounter = 0;

/**
 * Generate a unique event ID
 * Format: evt-{counter}
 */
export function generateEventId(): string {
  return `evt-${++eventCounter}`;
}

/**
 * Reset the event counter (useful for testing or new games)
 */
export function resetEventCounter(): void {
  eventCounter = 0;
}

/**
 * Sync the event counter with existing events (for reconnect/undo)
 * Sets counter to the highest event number found in the event log
 */
export function syncEventCounter(events: Array<{ id?: string }>): void {
  let maxId = 0;
  for (const event of events) {
    if (event.id && event.id.startsWith("evt-")) {
      const num = parseInt(event.id.slice(4), 10);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
  }
  eventCounter = maxId;
  engineLogger.debug(
    `[id-generator] Synced counter to ${maxId} from ${events.length} events`,
  );
}
