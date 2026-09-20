import { useMemo, useEffect, useState } from "preact/hooks";
import { uiLogger } from "../../lib/logger";
import type { DevtoolsEvent, EventDevtoolsAdapter } from "./adapter";

const ALL_EVENTS = "all";

export function useFilteredEvents<E extends DevtoolsEvent>(
  events: E[],
  filter: string,
  adapter: EventDevtoolsAdapter<E>,
) {
  return useMemo(() => {
    if (filter === ALL_EVENTS) return events;
    return events.filter(e => adapter.category(e) === filter);
  }, [events, filter, adapter]);
}

export function useRootEvents<E extends DevtoolsEvent>(
  events: E[],
  adapter: EventDevtoolsAdapter<E>,
) {
  return useMemo(() => {
    return events.filter(e => adapter.isRoot(e));
  }, [events, adapter]);
}

/**
 * The state the adapter reports at that point in the log. A game answers
 * straight away from a local replay or later from the host, so a pending
 * answer reads as no state rather than as the state of another index.
 */
function useHistoricalState<E extends DevtoolsEvent>(
  adapter: EventDevtoolsAdapter<E>,
  index: number | null,
): unknown {
  const [resolved, setResolved] = useState<{
    index: number;
    state: unknown;
  } | null>(null);

  useEffect(() => {
    const stateAt = adapter.stateAt;
    if (!stateAt || index === null || index < 0) return;
    const request = { active: true };
    const settle = (state: unknown) => {
      if (request.active) setResolved({ index, state });
    };
    const failed = (error: unknown) => {
      uiLogger.error("Could not read the state at that event", { error });
      if (request.active) setResolved(null);
    };
    try {
      const lookup = stateAt.call(adapter, index);
      if (lookup instanceof Promise) {
        lookup.then(settle).catch(failed);
      } else {
        settle(lookup);
      }
    } catch (error: unknown) {
      failed(error);
    }
    return () => {
      request.active = false;
    };
  }, [adapter, index]);

  if (!adapter.stateAt || index === null || index < 0) return null;
  return resolved?.index === index ? resolved.state : null;
}

export function useSelectedState<E extends DevtoolsEvent>(
  adapter: EventDevtoolsAdapter<E>,
  displayIndex: number | null,
): unknown {
  return useHistoricalState(adapter, displayIndex);
}

export function usePrevState<E extends DevtoolsEvent>(
  adapter: EventDevtoolsAdapter<E>,
  displayIndex: number | null,
): unknown {
  return useHistoricalState(
    adapter,
    displayIndex === null ? null : displayIndex - 1,
  );
}
