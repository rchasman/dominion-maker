import { useEffect, useRef } from "preact/hooks";
import { uiLogger } from "../lib/logger";
/**
 * Options for syncing to localStorage
 */
export interface SyncToLocalStorageOptions<T> {
  /**
   * Custom serialization function (defaults to JSON.stringify)
   */
  serialize?: (value: T) => string;
  /**
   * Whether to sync (can disable conditionally)
   */
  shouldSync?: boolean;
}

/**
 * Syncs a value to localStorage, skipping the initial hydration render
 *
 * This hook solves the common pattern of wanting to persist state to localStorage
 * without triggering a save immediately after loading. It uses a ref to track
 * whether hydration is complete, eliminating the need for component-level refs.
 *
 * @example
 * ```tsx
 * const [count, setCount] = useState(0);
 * useSyncToLocalStorage('count', count);
 * ```
 *
 * @example
 * ```tsx
 * // With conditional sync
 * useSyncToLocalStorage('events', events, {
 *   shouldSync: events.length > 0
 * });
 * ```
 */
const DEBOUNCE_MS = 500;

export function useSyncToLocalStorage<T>(
  key: string,
  value: T,
  options: SyncToLocalStorageOptions<T> = {},
): void {
  const { serialize = JSON.stringify, shouldSync = true } = options;

  const isHydratingRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingWriteRef = useRef<(() => void) | null>(null);

  // Mark hydration complete after first render
  useEffect(() => {
    isHydratingRef.current = false;
  }, []);

  // Debounced sync to localStorage (skip during hydration)
  useEffect(() => {
    if (!shouldSync || isHydratingRef.current) return;

    const writeToStorage = () => {
      try {
        localStorage.setItem(key, serialize(value));
      } catch (error) {
        uiLogger.error("Failed to save to localStorage", { key, error });

        // If quota exceeded, clear this specific key and retry once
        if (
          error instanceof DOMException &&
          error.name === "QuotaExceededError"
        ) {
          uiLogger.warn("Quota exceeded, clearing and retrying", { key });
          try {
            localStorage.removeItem(key);
            localStorage.setItem(key, serialize(value));
          } catch (retryError) {
            uiLogger.error("Retry failed", { key, error: retryError });
          }
        }
      }
    };

    pendingWriteRef.current = writeToStorage;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      writeToStorage();
      pendingWriteRef.current = null;
      timerRef.current = null;
    }, DEBOUNCE_MS);
  }, [key, value, serialize, shouldSync]);

  // Flush pending writes and clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pendingWriteRef.current !== null) {
        pendingWriteRef.current();
        pendingWriteRef.current = null;
      }
    };
  }, []);
}
