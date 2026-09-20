import type { MutableRef, StateUpdater, Dispatch } from "preact/hooks";
import { useCallback } from "preact/hooks";
import type { DevtoolsEvent } from "./adapter";
import { useScrubberHandlers } from "./scrubberHandlers";

interface HandlerDeps<E extends DevtoolsEvent> {
  events: E[];
  rootEvents: E[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  isPlaying: boolean;
  playIntervalRef: MutableRef<NodeJS.Timeout | null>;
  onScrub: ((eventId: string | null) => void) | undefined;
  onBranchFrom: ((eventId: string) => void) | undefined;
}

interface HandlerActions {
  setScrubberIndex: Dispatch<StateUpdater<number | null>>;
  setSelectedEventId: Dispatch<StateUpdater<string | null>>;
  setIsPlaying: Dispatch<StateUpdater<boolean>>;
}

export function useEventHandlers<E extends DevtoolsEvent>(
  deps: HandlerDeps<E>,
  actions: HandlerActions,
) {
  const {
    events,
    rootEvents,
    selectedEventId,
    scrubberIndex,
    isPlaying,
    playIntervalRef,
    onScrub,
    onBranchFrom,
  } = deps;

  const { setScrubberIndex, setSelectedEventId, setIsPlaying } = actions;

  const scrubberHandlers = useScrubberHandlers(
    { events, rootEvents, scrubberIndex, isPlaying, playIntervalRef, onScrub },
    { setScrubberIndex, setSelectedEventId, setIsPlaying },
  );

  const handleEventClick = useCallback(
    (event: E, eventIndex: number, isScrubberPosition: boolean) => {
      const isSelected =
        selectedEventId === event.id || scrubberIndex === eventIndex;
      const newSelectedId =
        isSelected && !isScrubberPosition ? null : event.id || null;

      setSelectedEventId(newSelectedId);
      setScrubberIndex(eventIndex);

      if (onScrub && event.id) {
        onScrub(event.id);
      }
    },
    [
      selectedEventId,
      scrubberIndex,
      onScrub,
      setSelectedEventId,
      setScrubberIndex,
    ],
  );

  const handleBranchFromEvent = useCallback(
    (eventId: string) => {
      if (onBranchFrom) {
        onBranchFrom(eventId);
        scrubberHandlers.handleResetScrubber();
      }
    },
    [onBranchFrom, scrubberHandlers],
  );

  return {
    ...scrubberHandlers,
    handleEventClick,
    handleBranchFromEvent,
  };
}
