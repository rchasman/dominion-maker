/**
 * Dominion's reading of its own event log for the shared event devtools:
 * which events the scrubber stops on, how one reads, what colour it wears,
 * which filter chip it answers to and the state it leaves behind.
 */
import { useMemo } from "preact/hooks";
import type { EventDevtoolsAdapter } from "../EventDevtools/adapter";
import { useDominionSession } from "../../session/SessionContext";
import type { GameEvent } from "../../events/types";
import { isRootCauseEvent } from "../../events/types";
import { projectState } from "../../events/project";

const PROMPT_PREVIEW_MAX_LENGTH = 30;
const DEFAULT_COLOR = "#6b7280";

const EVENT_COLORS: Record<string, string> = {
  // Setup
  GAME_INITIALIZED: "#22c55e",
  INITIAL_DECK_DEALT: "#22c55e",
  INITIAL_HAND_DRAWN: "#22c55e",

  // Turn structure
  TURN_STARTED: "#f59e0b",
  PHASE_CHANGED: "#f59e0b",

  // Card movements
  CARDS_DRAWN: "#3b82f6",
  CARD_PLAYED: "#8b5cf6",
  CARDS_DISCARDED: "#6b7280",
  CARDS_TRASHED: "#ef4444",
  CARD_GAINED: "#10b981",
  CARDS_REVEALED: "#06b6d4",
  DECK_SHUFFLED: "#a855f7",
  CARDS_PUT_ON_DECK: "#6366f1",

  // Resources
  ACTIONS_MODIFIED: "#eab308",
  BUYS_MODIFIED: "#84cc16",
  COINS_MODIFIED: "#fbbf24",

  // Decisions
  DECISION_REQUIRED: "#f97316",
  DECISION_RESOLVED: "#22d3ee",

  // Game end
  GAME_ENDED: "#dc2626",

  // Undo
  UNDO_REQUESTED: "#f472b6",
  UNDO_APPROVED: "#34d399",
  UNDO_DENIED: "#f87171",
  UNDO_EXECUTED: "#c084fc",
};

const DOMINION_EVENT_CATEGORIES = [
  "turns",
  "cards",
  "resources",
  "decisions",
] as const;

const CATEGORY_MEMBERS: Record<string, string[]> = {
  turns: ["TURN_STARTED", "PHASE_CHANGED", "GAME_ENDED"],
  cards: [
    "CARD_DRAWN",
    "CARD_PLAYED",
    "CARD_DISCARDED",
    "CARD_TRASHED",
    "CARD_GAINED",
    "DECK_SHUFFLED",
  ],
  resources: ["ACTIONS_MODIFIED", "BUYS_MODIFIED", "COINS_MODIFIED"],
  decisions: ["DECISION_REQUIRED", "DECISION_RESOLVED"],
};

const CATEGORY_OF_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_MEMBERS).flatMap(([category, types]) =>
    types.map(type => [type, category]),
  ),
);

/** Format event for display */
function formatEvent(event: GameEvent): string {
  const formatDelta = (delta: number) =>
    delta >= 0 ? `+${delta}` : String(delta);

  switch (event.type) {
    case "CARD_DRAWN":
      return `${event.playerId} drew ${event.card}`;
    case "CARD_PLAYED":
      return `${event.playerId} played ${event.card}`;
    case "CARD_DISCARDED":
      return `${event.playerId} discarded ${event.card}`;
    case "CARD_GAINED":
      return `${event.playerId} gained ${event.card} to ${event.to}`;
    case "TURN_STARTED":
      return `Turn ${event.turn} - ${event.playerId}`;
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
      return `Winner: ${event.winnerId}`;
    default:
      return event.type;
  }
}

/**
 * A log that does not open with GAME_INITIALIZED is a room's redacted view,
 * which only the host can replay: the state comes back over the wire.
 */
function dominionStateAt(
  events: GameEvent[],
  index: number,
  getStateAtEvent: (eventId: string) => unknown,
): unknown {
  const isRemote = events.length > 0 && events[0]?.type !== "GAME_INITIALIZED";
  if (!isRemote) return projectState(events.slice(0, index + 1));
  const eventId = events[index]?.id;
  if (!eventId) return null;
  return Promise.resolve(getStateAtEvent(eventId));
}

export function useDominionDevtoolsAdapter(
  events: GameEvent[],
): EventDevtoolsAdapter<GameEvent> {
  const { getStateAtEvent } = useDominionSession();
  return useMemo(
    () => ({
      isRoot: event => isRootCauseEvent(event),
      label: event => formatEvent(event),
      category: event => CATEGORY_OF_TYPE[event.type] ?? "",
      categories: DOMINION_EVENT_CATEGORIES,
      colour: event => EVENT_COLORS[event.type] ?? DEFAULT_COLOR,
      stateAt: index => dominionStateAt(events, index, getStateAtEvent),
    }),
    [events, getStateAtEvent],
  );
}
