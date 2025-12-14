import type { StateUpdater, MutableRef } from "preact/hooks";
import { useEffect, useRef, useCallback } from "preact/hooks";
import type { GameEvent } from "../../events/types";

const PLAYBACK_INTERVAL_MS = 500;

interface PlaybackConfig {
  isPlaying: boolean;
  rootEvents: GameEvent[];
  events: GameEvent[];
  onScrub: ((eventId: string | null) => void) | undefined;
}

interface PlaybackActions {
  setScrubberIndex: StateUpdater<number | null>;
  setIsPlaying: StateUpdater<boolean>;
}

export function useListScroll(scrubberIndex: number | null) {
  const listRefInternalRef = useRef<HTMLDivElement | null>(null);

  const listRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node && !scrubberIndex) {
        node.scrollTop = node.scrollHeight;
      }
      listRefInternalRef.current = node;
    },
    [scrubberIndex],
  );

  return { listRef, listRefInternalRef };
}

export function useAutoScroll(
  scrubberIndex: number | null,
  eventsLength: number,
  isOpen: boolean,
  listRefInternalRef: MutableRef<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (scrubberIndex === null && isOpen) {
      const node = listRefInternalRef.current;
      if (node) {
        requestAnimationFrame(() => {
          node.scrollTop = node.scrollHeight;
        });
      }
    }
  }, [eventsLength, scrubberIndex, isOpen, listRefInternalRef]);
}

export function useScrubberScroll(
  scrubberIndex: number | null,
  listRefInternalRef: MutableRef<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (scrubberIndex !== null && listRefInternalRef.current) {
      const eventElements =
        listRefInternalRef.current.querySelectorAll("[data-event-index]");
      const targetElement = Array.from(eventElements).find(
        el => el.getAttribute("data-event-index") === String(scrubberIndex),
      ) as HTMLElement | undefined;

      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [scrubberIndex, listRefInternalRef]);
}

export function usePlayback(config: PlaybackConfig, actions: PlaybackActions) {
  const { isPlaying, rootEvents, events, onScrub } = config;
  const { setScrubberIndex, setIsPlaying } = actions;
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying && rootEvents.length > 0) {
      playIntervalRef.current = setInterval(() => {
        setScrubberIndex(prev => {
          const currentRootIndex =
            prev !== null
              ? rootEvents.findIndex(e => e.id === events[prev]?.id)
              : -1;

          const nextRootIndex = currentRootIndex + 1;

          if (nextRootIndex >= rootEvents.length) {
            setIsPlaying(false);
            if (playIntervalRef.current) {
              clearInterval(playIntervalRef.current);
              playIntervalRef.current = null;
            }
            return prev;
          }

          const nextRoot = rootEvents[nextRootIndex];
          const nextActualIndex = events.findIndex(
            evt => evt.id === nextRoot?.id,
          );

          if (onScrub && nextRoot?.id) {
            onScrub(nextRoot.id);
          }

          return nextActualIndex;
        });
      }, PLAYBACK_INTERVAL_MS);

      return () => {
        if (playIntervalRef.current) {
          clearInterval(playIntervalRef.current);
          playIntervalRef.current = null;
        }
      };
    }

    return;
  }, [isPlaying, rootEvents, events, onScrub, setScrubberIndex, setIsPlaying]);

  useEffect(() => {
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, []);

  return playIntervalRef;
}
