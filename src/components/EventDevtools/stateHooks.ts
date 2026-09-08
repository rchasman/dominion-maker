import { getStateAtEvent$ } from "../../context/game-signals";
import type { GameState } from "../../types/game-state";
import { useMemo, useEffect, useState } from "preact/hooks";
import type { GameEvent } from "../../events/types";
import type { EventCategory } from "./constants";
import { projectState } from "../../events/project";
import { isRootCauseEvent } from "../../events/types";
import { CATEGORY_FILTERS } from "./constants";

export function useFilteredEvents(events: GameEvent[], filter: EventCategory) {
  return useMemo(() => {
    if (filter === "all") return events;
    const types = CATEGORY_FILTERS[filter];
    return events.filter(e => types.includes(e.type));
  }, [events, filter]);
}

export function useRootEvents(events: GameEvent[]) {
  return useMemo(() => {
    return events.filter(e => isRootCauseEvent(e));
  }, [events]);
}

function useHistoricalState(events: GameEvent[], index: number | null) {
  const getState = getStateAtEvent$.value;
  const eventId = index === null ? undefined : events[index]?.id;
  const remote = events.length > 0 && events[0]?.type !== "GAME_INITIALIZED";
  const [result, setResult] = useState<{
    eventId: string;
    state: GameState;
  } | null>(null);
  useEffect(() => {
    if (!remote || !eventId || !getState) return;
    const request = { active: true };
    void Promise.resolve()
      .then(() => getState(eventId))
      .then(state => {
        if (request.active) setResult({ eventId, state });
      })
      .catch(() => {
        if (request.active) setResult(null);
      });
    return () => {
      request.active = false;
    };
  }, [eventId, remote, getState]);
  return useMemo(() => {
    if (index === null || index < 0) return null;
    if (remote)
      return result && result.eventId === eventId ? result.state : null;
    return projectState(events.slice(0, index + 1));
  }, [events, index, remote, result, eventId]);
}

export function useSelectedState(
  events: GameEvent[],
  displayIndex: number | null,
) {
  return useHistoricalState(events, displayIndex);
}
export function usePrevState(events: GameEvent[], displayIndex: number | null) {
  return useHistoricalState(
    events,
    displayIndex === null ? null : displayIndex - 1,
  );
}
