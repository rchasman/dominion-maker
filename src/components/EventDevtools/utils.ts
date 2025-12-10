import type { GameEvent } from "../../events/types";

const PROMPT_PREVIEW_MAX_LENGTH = 30;

/**
 * Calculate display index with readable logic
 */
export function getDisplayIndex(
  scrubberIndex: number | null,
  selectedEventId: string | null,
  events: GameEvent[],
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

/**
 * Format event for display
 */
export function formatEvent(event: GameEvent): string {
  const formatDelta = (delta: number) => (delta >= 0 ? `+${delta}` : String(delta));

  switch (event.type) {
    case "CARD_DRAWN":
      return `${event.player} drew ${event.card}`;
    case "CARD_PLAYED":
      return `${event.player} played ${event.card}`;
    case "CARD_DISCARDED":
      return `${event.player} discarded ${event.card}`;
    case "CARD_GAINED":
      return `${event.player} gained ${event.card} to ${event.to}`;
    case "TURN_STARTED":
      return `Turn ${event.turn} - ${event.player}`;
    case "PHASE_CHANGED":
      return `Phase: ${event.phase}`;
    case "ACTIONS_MODIFIED":
      return `Actions ${formatDelta(event.delta)}`;
    case "BUYS_MODIFIED":
      return `Buys ${formatDelta(event.delta)}`;
    case "COINS_MODIFIED":
      return `Coins ${formatDelta(event.delta)}`;
    case "DECISION_REQUIRED":
      return `Decision: ${event.decision.prompt.slice(0, PROMPT_PREVIEW_MAX_LENGTH)}...`;
    case "DECISION_RESOLVED":
      return `Decision: ${event.choice.selectedCards.join(", ") || "(skip)"}`;
    case "GAME_ENDED":
      return `Winner: ${event.winner}`;
    default:
      return event.type;
  }
}
