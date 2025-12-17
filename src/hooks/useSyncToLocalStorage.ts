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
export function useSyncToLocalStorage<T>(
  key: string,
  value: T,
  options: SyncToLocalStorageOptions<T> = {},
): void {
  const { serialize = JSON.stringify, shouldSync = true } = options;

  const isHydratingRef = useRef(true);

  // Mark hydration complete after first render
  useEffect(() => {
    isHydratingRef.current = false;
  }, []);

  // Sync to localStorage (skip during hydration)
  useEffect(() => {
    if (!shouldSync || isHydratingRef.current) return;

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
  }, [key, value, serialize, shouldSync]);
}
