import { useEffect, useRef } from "preact/compat";

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

  const isHydrating = useRef(true);

  // Mark hydration complete after first render
  useEffect(() => {
    isHydrating.current = false;
  }, []);

  // Sync to localStorage (skip during hydration)
  useEffect(() => {
    if (!shouldSync || isHydrating.current) return;

    try {
      localStorage.setItem(key, serialize(value));
    } catch (error) {
      console.error(`Failed to save ${key} to localStorage:`, error);

      // If quota exceeded, clear this specific key and retry once
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.warn(`Quota exceeded for ${key}, clearing and retrying...`);
        try {
          localStorage.removeItem(key);
          localStorage.setItem(key, serialize(value));
        } catch (retryError) {
          console.error(`Retry failed for ${key}:`, retryError);
        }
      }
    }
  }, [key, value, serialize, shouldSync]);
}
