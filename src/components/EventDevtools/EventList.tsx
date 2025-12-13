import { useCallback } from "react";
import type { GameEvent } from "../../events/types";
import { isRootCauseEvent } from "../../events/types";
import { EVENT_COLORS, styles } from "./constants";
import { formatEvent } from "./utils";

interface EventListProps {
  filteredEvents: GameEvent[];
  events: GameEvent[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  listRef: (node: HTMLDivElement | null) => void;
  onEventClick: (
    event: GameEvent,
    eventIndex: number,
    isScrubberPosition: boolean,
  ) => void;
  onBranchFrom?: (eventId: string) => void;
}

const BRANCH_BUTTON = "⎌";
const PLAYHEAD = "▶";
const CAUSAL_ARROW = "└";
const PADDING_LEFT_NESTED = 32;
const PADDING_LEFT_BASE = 12;
const BORDER_RIGHT_WIDTH = 3;

interface EventRightButtonProps {
  isScrubberPosition: boolean;
  isRoot: boolean;
  eventId: string | undefined;
  onBranchFrom: ((eventId: string) => void) | undefined;
  handleBranch: (eventId: string | undefined) => void;
}

function renderEventRightButton({
  isScrubberPosition,
  isRoot,
  eventId,
  onBranchFrom,
  handleBranch,
}: EventRightButtonProps) {
  if (isScrubberPosition && isRoot && onBranchFrom && eventId) {
    return (
      <button
        onClick={e => {
          e.stopPropagation();
          handleBranch(eventId);
        }}
        style={styles.inlineBranchButton}
        title="Branch from here"
      >
        {BRANCH_BUTTON}
      </button>
    );
  }

  if (isScrubberPosition) {
    return <span style={styles.playhead}>{PLAYHEAD}</span>;
  }

  return null;
}

interface EventItemProps {
  event: GameEvent;
  events: GameEvent[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  onEventClick: (
    event: GameEvent,
    eventIndex: number,
    isScrubberPosition: boolean,
  ) => void;
  onBranchFrom: ((eventId: string) => void) | undefined;
  handleBranch: (eventId: string | undefined) => void;
}

function EventItem({
  event,
  events,
  selectedEventId,
  scrubberIndex,
  onEventClick,
  onBranchFrom,
  handleBranch,
}: EventItemProps) {
  const eventIndex = events.indexOf(event);
  const isSelected =
    selectedEventId === event.id || scrubberIndex === eventIndex;
  const isRoot = isRootCauseEvent(event);
  const hasParent = Boolean(event.causedBy);
  const isScrubberPosition = scrubberIndex === eventIndex;

  // Calculate actual nesting depth by traversing causedBy chain
  const getDepth = (evt: GameEvent): number => {
    if (!evt.causedBy) return 0;
    const parent = events.find(e => e.id === evt.causedBy);
    if (!parent) return 1;
    return 1 + getDepth(parent);
  };

  const depth = getDepth(event);
  const paddingPerLevel = 20;
  const basePadding = 12;
  const calculatedPadding = basePadding + depth * paddingPerLevel;

  return (
    <div
      key={`${event.id}-${eventIndex}`}
      data-event-index={eventIndex}
      onClick={() => {
        onEventClick(event, eventIndex, isScrubberPosition);
      }}
      style={{
        ...styles.eventItem,
        background: isSelected ? "rgba(99, 102, 241, 0.2)" : undefined,
        borderLeftColor: EVENT_COLORS[event.type] || "#6b7280",
        paddingLeft: `${calculatedPadding}px`,
        position: "relative",
        borderRight: isScrubberPosition
          ? `${BORDER_RIGHT_WIDTH}px solid #6366f1`
          : "none",
      }}
    >
      {hasParent && <span style={styles.causalArrow}>{CAUSAL_ARROW}</span>}
      <span style={styles.eventId}>{event.id}</span>
      <span
        style={{
          ...styles.eventType,
          color: EVENT_COLORS[event.type] || "#6b7280",
        }}
      >
        {event.type}
      </span>
      <span style={styles.eventDetail}>{formatEvent(event)}</span>
      {renderEventRightButton({
        isScrubberPosition,
        isRoot,
        eventId: event.id,
        onBranchFrom,
        handleBranch,
      })}
    </div>
  );
}

/**
 * Event list rendering
 */
export function EventList({
  filteredEvents,
  events,
  selectedEventId,
  scrubberIndex,
  listRef,
  onEventClick,
  onBranchFrom,
}: EventListProps) {
  const handleBranch = useCallback(
    (eventId: string | undefined) => {
      if (eventId && onBranchFrom) {
        onBranchFrom(eventId);
      }
    },
    [onBranchFrom],
  );

  return (
    <div
      ref={listRef}
      style={{
        ...styles.eventList,
        flex: "0 1 50%",
      }}
    >
      {filteredEvents.map(event => (
        <EventItem
          key={`${event.id}-${events.indexOf(event)}`}
          event={event}
          events={events}
          selectedEventId={selectedEventId}
          scrubberIndex={scrubberIndex}
          onEventClick={onEventClick}
          onBranchFrom={onBranchFrom}
          handleBranch={handleBranch}
        />
      ))}
    </div>
  );
}
