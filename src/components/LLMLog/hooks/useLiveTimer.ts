import { useState, useEffect } from "preact/hooks";
import type { Turn } from "../types";
import { hasLiveConsensus } from "./useTurnExtraction";

const TIMER_INTERVAL_MS = 50;

/**
 * Current timestamp, refreshed every 50ms while a consensus is live so pending
 * model durations count up. Idle otherwise.
 */
export const useLiveTimer = (turns: Turn[]): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasLiveConsensus(turns)) return;

    const interval = setInterval(() => setNow(Date.now()), TIMER_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [turns]);

  return now;
};
