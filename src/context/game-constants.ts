/**
 * Timing and threshold constants for game sessions
 * Eliminates magic numbers and provides semantic meaning
 */

// Timing constants (in milliseconds)
export const TIMING = {
  AI_STEP_DELAY: 500,
  AUTO_ADVANCE_DELAY: 300,
} as const;

// Game state constants
export const MIN_TURN_FOR_STRATEGY = 1;
