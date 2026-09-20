import { useState, useCallback } from "preact/hooks";

/** Scrubbing to a past event, for any game whose log can be replayed */
interface PreviewModeHook {
  previewEventId: string | null;
  enterPreview: (eventId: string | null) => void;
  exitPreview: () => void;
  isPreviewMode: boolean;
}

export function usePreviewMode(): PreviewModeHook {
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);

  const enterPreview = useCallback((eventId: string | null) => {
    setPreviewEventId(eventId);
  }, []);

  const exitPreview = useCallback(() => {
    setPreviewEventId(null);
  }, []);

  const isPreviewMode = previewEventId !== null;

  return {
    previewEventId,
    enterPreview,
    exitPreview,
    isPreviewMode,
  };
}
