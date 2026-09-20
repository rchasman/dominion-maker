import { describe, it, expect } from "bun:test";
import { getDisplayIndex } from "./utils";
import type { DevtoolsEvent } from "./adapter";

describe("EventDevtools/utils", () => {
  describe("getDisplayIndex", () => {
    const events: DevtoolsEvent[] = [
      { id: "event-1", type: "MOVE" },
      { id: "event-2", type: "NOTE", causedBy: "event-1" },
      { id: "event-3", type: "MOVE" },
    ];

    it("should return scrubberIndex when provided", () => {
      const index = getDisplayIndex(1, "event-3", events);
      expect(index).toBe(1);
    });

    it("should return index of selected event when scrubberIndex is null", () => {
      const index = getDisplayIndex(null, "event-2", events);
      expect(index).toBe(1);
    });

    it("should return last event index when both scrubberIndex and selectedEventId are null", () => {
      const index = getDisplayIndex(null, null, events);
      expect(index).toBe(2);
    });

    it("should return null when events array is empty", () => {
      const index = getDisplayIndex(null, null, []);
      expect(index).toBe(null);
    });

    it("should return -1 when selected event not found", () => {
      const index = getDisplayIndex(null, "nonexistent", events);
      expect(index).toBe(-1);
    });

    it("should prioritize scrubberIndex over selectedEventId", () => {
      const index = getDisplayIndex(0, "event-3", events);
      expect(index).toBe(0);
    });
  });
});
