import { useEffect, useState } from "preact/hooks";

interface PreviewState<S> {
  state: S | null;
  error: string | null;
  isLoading: boolean;
}

interface ResolvedPreview<S> {
  eventId: string;
  state: S | null;
  error: string | null;
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Preview unavailable";

/**
 * Resolves the game state for the previewed event. A synchronous lookup
 * settles inside the effect, and while an asynchronous lookup is in flight
 * the previously resolved state stays visible so the board never falls back
 * to live state or unmounts between scrubber steps.
 */
export function usePreviewState<S>(
  previewEventId: string | null,
  getStateAtEvent: (eventId: string) => S | Promise<S>,
): PreviewState<S> {
  const [resolved, setResolved] = useState<ResolvedPreview<S> | null>(null);

  useEffect(() => {
    if (!previewEventId) {
      setResolved(null);
      return;
    }

    const request = { active: true };
    const settle = (next: ResolvedPreview<S>) => {
      if (request.active) setResolved(next);
    };

    try {
      const lookup = getStateAtEvent(previewEventId);
      if (lookup instanceof Promise) {
        lookup
          .then(state =>
            settle({ eventId: previewEventId, state, error: null }),
          )
          .catch((error: unknown) =>
            settle({
              eventId: previewEventId,
              state: null,
              error: errorMessage(error),
            }),
          );
      } else {
        settle({ eventId: previewEventId, state: lookup, error: null });
      }
    } catch (error: unknown) {
      settle({
        eventId: previewEventId,
        state: null,
        error: errorMessage(error),
      });
    }

    return () => {
      request.active = false;
    };
  }, [previewEventId, getStateAtEvent]);

  if (!previewEventId) {
    return { state: null, error: null, isLoading: false };
  }

  const isCurrent = resolved?.eventId === previewEventId;
  return {
    state: resolved?.state ?? null,
    error: isCurrent ? resolved.error : null,
    isLoading: !isCurrent,
  };
}
