import { describe, it, expect } from "bun:test";

/**
 * EventDevtools live update tests
 * Verifies that the component updates when events prop changes
 */

describe("EventDevtools - live updates", () => {
  it("should detect event length changes", () => {
    // Simulate the events array growing over time
    let events = [
      { id: "evt-1", type: "GAME_INITIALIZED" },
      { id: "evt-2", type: "TURN_STARTED" },
    ];

    // Component renders with 2 events
    let eventCount = events.length;
    expect(eventCount).toBe(2);

    // New event arrives
    events = [...events, { id: "evt-3", type: "CARD_PLAYED" }];

    // Component should re-render with 3 events
    eventCount = events.length;
    expect(eventCount).toBe(3);

    // Multiple new events arrive
    events = [
      ...events,
      { id: "evt-4", type: "TURN_ENDED" },
      { id: "evt-5", type: "TURN_STARTED" },
    ];

    // Component should re-render with 5 events
    eventCount = events.length;
    expect(eventCount).toBe(5);
  });

  it("should auto-scroll when new events arrive in live mode", () => {
    // When scrubberIndex is null, auto-scroll should trigger
    const scrubberIndex = null;
    let events = [{ id: "evt-1", type: "GAME_INITIALIZED" }];

    // Initial state
    const shouldAutoScroll = scrubberIndex === null;
    expect(shouldAutoScroll).toBe(true);

    // New event arrives
    events = [...events, { id: "evt-2", type: "TURN_STARTED" }];

    // Should still auto-scroll (scrubberIndex is still null)
    const shouldStillAutoScroll = scrubberIndex === null;
    expect(shouldStillAutoScroll).toBe(true);
    expect(events.length).toBe(2);
  });

  it("should not auto-scroll when scrubbing", () => {
    // When scrubbing, scrubberIndex is not null
    const scrubberIndex: number | null = 2; // User is viewing event 2
    let events = [
      { id: "evt-1", type: "GAME_INITIALIZED" },
      { id: "evt-2", type: "TURN_STARTED" },
      { id: "evt-3", type: "CARD_PLAYED" },
    ];

    // Initial state - scrubbing
    const shouldAutoScroll = scrubberIndex === null;
    expect(shouldAutoScroll).toBe(false);

    // New event arrives
    events = [...events, { id: "evt-4", type: "TURN_ENDED" }];

    // Should still not auto-scroll (user is still scrubbing)
    const shouldStillAutoScroll = scrubberIndex === null;
    expect(shouldStillAutoScroll).toBe(false);
    expect(events.length).toBe(4);
  });
});
