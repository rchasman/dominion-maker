/**
 * Milliseconds for durations. Browsers and Bun have performance.now();
 * the PartyKit worker runtime does not, so fall back to the wall clock.
 */
export const nowMs = (): number =>
  typeof performance === "object" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
