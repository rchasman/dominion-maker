import { useCallback } from "preact/hooks";
import type { GameEvent } from "../../events/types";

interface ScrubberDeps {
  events: GameEvent[];
  rootEvents: GameEvent[];
  scrubberIndex: number | null;
  isPlaying: boolean;
  playIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  onScrub: ((eventId: string | null) => void) | undefined;
}

interface ScrubberActions {
  setScrubberIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedEventId: React.Dispatch<React.SetStateAction<string | null>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

function stopPlayback(
  playIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>,
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>,
) {
  setIsPlaying(false);
  if (playIntervalRef.current) {
    clearInterval(playIntervalRef.current);
    playIntervalRef.current = null;
  }
}

function useHandleScrubberChange(
  rootEvents: GameEvent[],
  events: GameEvent[],
  onScrub: ((eventId: string | null) => void) | undefined,
  setScrubberIndex: React.Dispatch<React.SetStateAction<number | null>>,
) {
  return useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement;
      const rootIndex = parseInt(target.value, 10);
      const rootEvent = rootEvents[rootIndex];
      if (!rootEvent) return;

      const actualIndex = events.findIndex(evt => evt.id === rootEvent.id);
      setScrubberIndex(actualIndex);

      if (onScrub && rootEvent.id) {
        onScrub(rootEvent.id);
      }
    },
    [rootEvents, events, onScrub, setScrubberIndex],
  );
}

function useHandleRewindToBeginning(
  rootEvents: GameEvent[],
  events: GameEvent[],
  onScrub: ((eventId: string | null) => void) | undefined,
  setScrubberIndex: React.Dispatch<React.SetStateAction<number | null>>,
) {
  return useCallback(() => {
    if (rootEvents.length > 0) {
      const firstRoot = rootEvents[0];
      const actualIndex = events.findIndex(evt => evt.id === firstRoot?.id);
      setScrubberIndex(actualIndex);
      if (onScrub && firstRoot?.id) {
        onScrub(firstRoot.id);
      }
    }
  }, [rootEvents, events, onScrub, setScrubberIndex]);
}

export function useScrubberHandlers(
  deps: ScrubberDeps,
  actions: ScrubberActions,
) {
  const {
    events,
    rootEvents,
    scrubberIndex,
    isPlaying,
    playIntervalRef,
    onScrub,
  } = deps;

  const { setScrubberIndex, setSelectedEventId, setIsPlaying } = actions;

  const handleScrubberChange = useHandleScrubberChange(
    rootEvents,
    events,
    onScrub,
    setScrubberIndex,
  );

  const handleRewindToBeginning = useHandleRewindToBeginning(
    rootEvents,
    events,
    onScrub,
    setScrubberIndex,
  );

  const handleResetScrubber = useCallback(() => {
    if (isPlaying) {
      stopPlayback(playIntervalRef, setIsPlaying);
    }

    setScrubberIndex(null);
    setSelectedEventId(null);

    if (onScrub) {
      onScrub(null);
    }
  }, [
    isPlaying,
    onScrub,
    playIntervalRef,
    setScrubberIndex,
    setSelectedEventId,
    setIsPlaying,
  ]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      stopPlayback(playIntervalRef, setIsPlaying);
      return;
    }

    setIsPlaying(true);

    const lastRootIndex = events.findIndex(
      evt => evt.id === rootEvents[rootEvents.length - 1]?.id,
    );
    if (scrubberIndex === null || scrubberIndex >= lastRootIndex) {
      handleRewindToBeginning();
    }
  }, [
    isPlaying,
    scrubberIndex,
    events,
    rootEvents,
    handleRewindToBeginning,
    playIntervalRef,
    setIsPlaying,
  ]);

  const handleScrubberChangeWithPause = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isPlaying) {
        stopPlayback(playIntervalRef, setIsPlaying);
      }
      handleScrubberChange(e);
    },
    [isPlaying, handleScrubberChange, playIntervalRef, setIsPlaying],
  );

  return {
    handleScrubberChange,
    handleResetScrubber,
    handleRewindToBeginning,
    handlePlayPause,
    handleScrubberChangeWithPause,
  };
}
