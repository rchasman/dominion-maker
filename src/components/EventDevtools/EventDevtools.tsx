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
 */
import { useState } from "preact/compat";
import type { GameEvent } from "../../events/types";
import type { EventCategory } from "./constants";
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

interface EventDevtoolsProps {
  events: GameEvent[];
  isOpen?: boolean;
  onToggle?: () => void;
  onBranchFrom?: (eventId: string) => void;
  onScrub?: (eventId: string | null) => void;
}

const TOGGLE_ICON = "{ }";

export function EventDevtools({
  events,
  isOpen = true,
  onToggle,
  onBranchFrom,
  onScrub,
}: EventDevtoolsProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventCategory>("all");
  const [showDiff, setShowDiff] = useState(false);
  const [scrubberIndex, setScrubberIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { listRef, listRefInternalRef } = useListScroll(scrubberIndex);
  const rootEvents = useRootEvents(events);
  const filteredEvents = useFilteredEvents(events, filter);
  const displayIndex = getDisplayIndex(scrubberIndex, selectedEventId, events);
  const selectedState = useSelectedState(events, displayIndex);
  const prevState = usePrevState(events, displayIndex);

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
      onToggle={onToggle}
      onFilterChange={setFilter}
      onToggleDiff={() => setShowDiff(!showDiff)}
      handlers={handlers}
    />
  );
}
