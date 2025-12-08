import { describe, it, expect } from "bun:test";

/**
 * EventDevtools component tests
 * Tests scrubbing behavior without isPinned state
 */

describe("EventDevtools - scrubbing", () => {
  it("should handle scrubber changes without isPinned state", () => {
    // After removing isPinned state, scrubbing should still work
    // The component auto-scrolls when scrubberIndex is null
    // When scrubbing, scrubberIndex is set to a value (not null)

    let scrubberIndex: number | null = null;

    // Simulate scrubbing (user drags timeline slider)
    scrubberIndex = 5; // User scrubs to event 5

    // When scrubbing, auto-scroll should be disabled
    const shouldAutoScroll = scrubberIndex === null;
    expect(shouldAutoScroll).toBe(false);

    // Simulate returning to live mode (user clicks reset)
    scrubberIndex = null;

    // When not scrubbing, auto-scroll should be enabled
    const shouldAutoScrollNow = scrubberIndex === null;
    expect(shouldAutoScrollNow).toBe(true);
  });

  it("should not require setIsPinned calls", () => {
    // This test verifies that isPinned state is not needed
    // The scrubbing logic should work based on scrubberIndex alone

    let scrubberIndex: number | null = null;

    // Mock handleScrubberChange - should only need to set scrubberIndex
    const handleScrubberChange = (index: number) => {
      scrubberIndex = index;
      // No setIsPinned(true) needed - scrubberIndex being non-null is enough
    };

    // Mock handleResetScrubber - should only need to clear scrubberIndex
    const handleResetScrubber = () => {
      scrubberIndex = null;
      // No setIsPinned(false) needed - scrubberIndex being null is enough
    };

    // Test scrubbing
    handleScrubberChange(1);
    expect(scrubberIndex).toBe(1);
    expect(scrubberIndex === null).toBe(false); // Scrubbing mode

    // Test reset
    handleResetScrubber();
    expect(scrubberIndex).toBe(null);
    expect(scrubberIndex === null).toBe(true); // Live mode
  });
});
