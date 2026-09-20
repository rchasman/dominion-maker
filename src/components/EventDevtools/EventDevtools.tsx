/**
 * Event Devtools - Redux-style visualizer for event-driven state
 *
 * Features:
 * - Live event stream with color-coded event types
 * - Timeline scrubber for replay control
 * - Click any event to see state at that point
 * - Branch from any point to create alternate timelines
 * - Diff view showing what changed
 * - Filter events by type
 *
 * Every game-specific reading of the log comes in through the adapter.
 */
import { useState } from "preact/hooks";
import type { DevtoolsEvent, EventDevtoolsAdapter } from "./adapter";
import { styles } from "./constants";
import { getDisplayIndex } from "./utils";
import { DevtoolsContainer } from "./DevtoolsContainer";
import {
  useListScroll,
  useAutoScroll,
  useScrubberScroll,
  usePlayback,
} from "./hooks";
import { useEventHandlers } from "./eventHandlers";
import {
  useFilteredEvents,
  useRootEvents,
  useSelectedState,
  usePrevState,
} from "./stateHooks";

interface EventDevtoolsProps<E extends DevtoolsEvent> {
  events: E[];
  adapter: EventDevtoolsAdapter<E>;
  isOpen?: boolean;
  onToggle?: () => void;
  onBranchFrom?: (eventId: string) => void;
  onScrub?: (eventId: string | null) => void;
}

const TOGGLE_ICON = "{ }";

export function EventDevtools<E extends DevtoolsEvent>({
  events,
  adapter,
  isOpen = true,
  onToggle,
  onBranchFrom,
  onScrub,
}: EventDevtoolsProps<E>) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showDiff, setShowDiff] = useState(false);
  const [scrubberIndex, setScrubberIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { listRef, listRefInternalRef } = useListScroll(scrubberIndex);
  const rootEvents = useRootEvents(events, adapter);
  const filteredEvents = useFilteredEvents(events, filter, adapter);
  const displayIndex = getDisplayIndex(scrubberIndex, selectedEventId, events);
  // A shut panel shows no state, so it must not ask a host for any
  const inspected = isOpen ? displayIndex : null;
  const selectedState = useSelectedState(adapter, inspected);
  const prevState = usePrevState(adapter, inspected);

  useAutoScroll(scrubberIndex, events.length, isOpen, listRefInternalRef);
  useScrubberScroll(scrubberIndex, listRefInternalRef);

  const playIntervalRef = usePlayback(
    { isPlaying, rootEvents, events, onScrub },
    { setScrubberIndex, setIsPlaying },
  );

  const handlers = useEventHandlers(
    {
      events,
      rootEvents,
      selectedEventId,
      scrubberIndex,
      isPlaying,
      playIntervalRef,
      onScrub,
      onBranchFrom,
    },
    { setScrubberIndex, setSelectedEventId, setIsPlaying },
  );

  if (!isOpen) {
    return (
      <button onClick={onToggle} style={styles.toggleButton}>
        <span style={styles.toggleIcon}>{TOGGLE_ICON}</span>
        <span style={styles.eventCount}>{events.length}</span>
      </button>
    );
  }

  return (
    <DevtoolsContainer
      events={events}
      adapter={adapter}
      filteredEvents={filteredEvents}
      rootEvents={rootEvents}
      selectedEventId={selectedEventId}
      scrubberIndex={scrubberIndex}
      isPlaying={isPlaying}
      filter={filter}
      showDiff={showDiff}
      displayIndex={displayIndex}
      selectedState={selectedState}
      prevState={prevState}
      listRef={listRef}
      {...(onToggle !== undefined && { onToggle })}
      {...(onBranchFrom !== undefined && {
        onBranchFrom: handlers.handleBranchFromEvent,
      })}
      onFilterChange={setFilter}
      onToggleDiff={() => setShowDiff(!showDiff)}
      handlers={handlers}
    />
  );
}
