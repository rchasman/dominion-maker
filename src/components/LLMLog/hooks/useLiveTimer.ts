import { useState, useEffect } from "react";
import type { LLMLogEntry } from "../types";

const TIMER_INTERVAL_MS = 50;

/**
 * Hook to track live time for pending consensus operations
 * Returns current timestamp that updates every 50ms when there are pending operations
 */
export const useLiveTimer = (entries: LLMLogEntry[]): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Check if there are any consensus-start entries without corresponding consensus-complete
    const hasPending = entries.some((entry, idx) => {
      if (entry.type === "consensus-start") {
        // Look for matching consensus-complete after this index
        const hasComplete = entries
          .slice(idx + 1)
          .some(
            e =>
              e.type === "consensus-complete" ||
              e.type === "consensus-model-aborted",
          );
        return !hasComplete;
      }
      return false;
    });

    if (!hasPending) return;

    const interval = setInterval(() => setNow(Date.now()), TIMER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [entries]);

  return now;
};
