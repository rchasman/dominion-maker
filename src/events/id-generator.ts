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
