import type { DevtoolsEvent, EventDevtoolsAdapter } from "./adapter";
import { TimelineScrubber } from "./TimelineScrubber";
import { EventList } from "./EventList";
import { DevtoolsHeader } from "./DevtoolsHeader";
import { FilterBar } from "./FilterBar";
import { StateInspector } from "./StateInspector";
import { styles } from "./constants";

interface DevtoolsContainerProps<E extends DevtoolsEvent> {
  events: E[];
  adapter: EventDevtoolsAdapter<E>;
  filteredEvents: E[];
  rootEvents: E[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  isPlaying: boolean;
  filter: string;
  showDiff: boolean;
  displayIndex: number | null;
  selectedState: unknown;
  prevState: unknown;
  listRef: (node: HTMLDivElement | null) => void;
  onToggle?: () => void;
  /** Absent where the game offers no way to branch from a past event */
  onBranchFrom?: (eventId: string) => void;
  onFilterChange: (filter: string) => void;
  onToggleDiff: () => void;
  handlers: {
    handleRewindToBeginning: () => void;
    handlePlayPause: () => void;
    handleScrubberChangeWithPause: (e: Event) => void;
    handleResetScrubber: () => void;
    handleEventClick: (
      event: E,
      eventIndex: number,
      isScrubberPosition: boolean,
    ) => void;
  };
}

export function DevtoolsContainer<E extends DevtoolsEvent>({
  events,
  adapter,
  filteredEvents,
  rootEvents,
  selectedEventId,
  scrubberIndex,
  isPlaying,
  filter,
  showDiff,
  displayIndex,
  selectedState,
  prevState,
  listRef,
  onToggle,
  onBranchFrom,
  onFilterChange,
  onToggleDiff,
  handlers,
}: DevtoolsContainerProps<E>) {
  return (
    <div style={styles.container}>
      <DevtoolsHeader
        eventsLength={events.length}
        scrubberIndex={scrubberIndex}
        {...(onToggle !== undefined && { onToggle })}
      />
      <TimelineScrubber
        rootEvents={rootEvents}
        events={events}
        scrubberIndex={scrubberIndex}
        isPlaying={isPlaying}
        onRewindToBeginning={handlers.handleRewindToBeginning}
        onPlayPause={handlers.handlePlayPause}
        onScrubberChange={handlers.handleScrubberChangeWithPause}
        onResetScrubber={handlers.handleResetScrubber}
      />
      <FilterBar
        categories={adapter.categories}
        filter={filter}
        onFilterChange={onFilterChange}
      />
      <EventList
        adapter={adapter}
        filteredEvents={filteredEvents}
        events={events}
        selectedEventId={selectedEventId}
        scrubberIndex={scrubberIndex}
        listRef={listRef}
        onEventClick={handlers.handleEventClick}
        {...(onBranchFrom !== undefined && { onBranchFrom })}
      />
      <StateInspector
        selectedState={selectedState}
        prevState={prevState}
        scrubberIndex={scrubberIndex}
        displayIndex={displayIndex}
        showDiff={showDiff}
        onToggleDiff={onToggleDiff}
      />
    </div>
  );
}
