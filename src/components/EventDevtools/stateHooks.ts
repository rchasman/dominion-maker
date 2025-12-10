import { useMemo } from "react";
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

export function useSelectedState(events: GameEvent[], displayIndex: number | null) {
  return useMemo(() => {
    if (displayIndex === null || displayIndex === -1) return null;
    return projectState(events.slice(0, displayIndex + 1));
  }, [events, displayIndex]);
}

export function usePrevState(events: GameEvent[], displayIndex: number | null) {
  return useMemo(() => {
    if (displayIndex === null || displayIndex <= 0) return null;
    return projectState(events.slice(0, displayIndex));
  }, [events, displayIndex]);
}
