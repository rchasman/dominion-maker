import type { DevtoolsEvent } from "./adapter";

/**
 * Calculate display index with readable logic
 */
export function getDisplayIndex<E extends DevtoolsEvent>(
  scrubberIndex: number | null,
  selectedEventId: string | null,
  events: E[],
): number | null {
  // Scrubber takes precedence
  if (scrubberIndex !== null) {
    return scrubberIndex;
  }

  // Use selected event if available
  if (selectedEventId) {
    return events.findIndex(e => e.id === selectedEventId);
  }

  // Fall back to latest event
  if (events.length > 0) {
    return events.length - 1;
  }

  return null;
}
