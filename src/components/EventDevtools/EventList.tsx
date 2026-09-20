import { useCallback } from "preact/hooks";
import type { DevtoolsEvent, EventDevtoolsAdapter } from "./adapter";
import { styles } from "./constants";

interface EventListProps<E extends DevtoolsEvent> {
  adapter: EventDevtoolsAdapter<E>;
  filteredEvents: E[];
  events: E[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  listRef: (node: HTMLDivElement | null) => void;
  onEventClick: (
    event: E,
    eventIndex: number,
    isScrubberPosition: boolean,
  ) => void;
  onBranchFrom?: (eventId: string) => void;
}

const BRANCH_BUTTON = "⎌";
const PLAYHEAD = "▶";
const CAUSAL_ARROW = "└";
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

interface EventItemProps<E extends DevtoolsEvent> {
  adapter: EventDevtoolsAdapter<E>;
  event: E;
  events: E[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  onEventClick: (
    event: E,
    eventIndex: number,
    isScrubberPosition: boolean,
  ) => void;
  onBranchFrom: ((eventId: string) => void) | undefined;
  handleBranch: (eventId: string | undefined) => void;
}

function EventItem<E extends DevtoolsEvent>({
  adapter,
  event,
  events,
  selectedEventId,
  scrubberIndex,
  onEventClick,
  onBranchFrom,
  handleBranch,
}: EventItemProps<E>) {
  const eventIndex = events.indexOf(event);
  const isSelected =
    selectedEventId === event.id || scrubberIndex === eventIndex;
  const isRoot = adapter.isRoot(event);
  const hasParent = Boolean(event.causedBy);
  const isScrubberPosition = scrubberIndex === eventIndex;

  // Calculate actual nesting depth by traversing causedBy chain
  const getDepth = (evt: E): number => {
    if (!evt.causedBy) return 0;
    const parent = events.find(e => e.id === evt.causedBy);
    if (!parent) return 1;
    return 1 + getDepth(parent);
  };

  const depth = getDepth(event);
  const paddingPerLevel = 20;
  const basePadding = 12;
  const calculatedPadding = basePadding + depth * paddingPerLevel;
  const colour = adapter.colour(event);

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
        borderLeftColor: colour,
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
          color: colour,
        }}
      >
        {event.type}
      </span>
      <span style={styles.eventDetail}>{adapter.label(event)}</span>
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
export function EventList<E extends DevtoolsEvent>({
  adapter,
  filteredEvents,
  events,
  selectedEventId,
  scrubberIndex,
  listRef,
  onEventClick,
  onBranchFrom,
}: EventListProps<E>) {
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
          adapter={adapter}
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
