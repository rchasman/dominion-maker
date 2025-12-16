import type { GameState } from "../../types/game-state";
import type { GameEvent } from "../../events/types";
import type { EventCategory } from "./constants";
import { TimelineScrubber } from "./TimelineScrubber";
import { EventList } from "./EventList";
import { DevtoolsHeader } from "./DevtoolsHeader";
import { FilterBar } from "./FilterBar";
import { StateInspector } from "./StateInspector";
import { styles } from "./constants";

interface DevtoolsContainerProps {
  events: GameEvent[];
  filteredEvents: GameEvent[];
  rootEvents: GameEvent[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  isPlaying: boolean;
  filter: EventCategory;
  showDiff: boolean;
  displayIndex: number | null;
  selectedState: GameState | null;
  prevState: GameState | null;
  listRef: (node: HTMLDivElement | null) => void;
  onToggle?: () => void;
  onFilterChange: (filter: EventCategory) => void;
  onToggleDiff: () => void;
  handlers: {
    handleRewindToBeginning: () => void;
    handlePlayPause: () => void;
    handleScrubberChangeWithPause: (e: Event) => void;
    handleResetScrubber: () => void;
    handleEventClick: (
      event: GameEvent,
      eventIndex: number,
      isScrubberPosition: boolean,
    ) => void;
    handleBranchFromEvent: (eventId: string) => void;
  };
}

export function DevtoolsContainer({
  events,
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
  onFilterChange,
  onToggleDiff,
  handlers,
}: DevtoolsContainerProps) {
  return (
    <div style={styles.container}>
      <DevtoolsHeader
        eventsLength={events.length}
        scrubberIndex={scrubberIndex}
        onToggle={onToggle}
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
      <FilterBar filter={filter} onFilterChange={onFilterChange} />
      <EventList
        filteredEvents={filteredEvents}
        events={events}
        selectedEventId={selectedEventId}
        scrubberIndex={scrubberIndex}
        listRef={listRef}
        onEventClick={handlers.handleEventClick}
        onBranchFrom={handlers.handleBranchFromEvent}
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
