import { useCallback } from "preact/compat";
import type { GameEvent } from "../../events/types";
import { useScrubberHandlers } from "./scrubberHandlers";

interface HandlerDeps {
  events: GameEvent[];
  rootEvents: GameEvent[];
  selectedEventId: string | null;
  scrubberIndex: number | null;
  isPlaying: boolean;
  playIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  onScrub: ((eventId: string | null) => void) | undefined;
  onBranchFrom: ((eventId: string) => void) | undefined;
}

interface HandlerActions {
  setScrubberIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedEventId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useEventHandlers(deps: HandlerDeps, actions: HandlerActions) {
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
    (event: GameEvent, eventIndex: number, isScrubberPosition: boolean) => {
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
