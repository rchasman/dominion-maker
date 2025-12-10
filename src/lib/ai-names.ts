/**
 * Cool AI names for full mode players
 */

const AI_NAMES = [
  // Greek letters
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Omega",
  "Sigma",
  "Theta",

  // Sci-fi AI names
  "Nova",
  "Nexus",
  "Cipher",
  "Echo",
  "Quantum",
  "Vector",
  "Matrix",
  "Vertex",

  // Mythological
  "Atlas",
  "Titan",
  "Apollo",
  "Zeus",
  "Athena",
  "Hermes",
  "Artemis",
  "Hera",

  // Tech inspired
  "Cortex",
  "Neural",
  "Logic",
  "Binary",
  "Helix",
  "Pulse",
  "Apex",
  "Prime",

  // Abstract
  "Zenith",
  "Axiom",
  "Paradox",
  "Enigma",
  "Prism",
  "Cascade",
  "Vortex",
  "Phoenix",
] as const;

export type AIName = (typeof AI_NAMES)[number];

const SHUFFLE_THRESHOLD = 0.5;

/**
 * Generate two unique random AI names
 */
export function generateAINames(): [string, string] {
  const shuffled = [...AI_NAMES].sort(() => Math.random() - SHUFFLE_THRESHOLD);
  return [shuffled[0], shuffled[1]];
}

/**
 * Get a specific AI name by index (deterministic for testing)
 */
export function getAIName(index: number): string {
  return AI_NAMES[index % AI_NAMES.length];
}

/**
 * Check if a player ID is an AI name
 */
export function isAIName(playerId: string): boolean {
  return AI_NAMES.includes(playerId as AIName);
}

/**
 * Get all available AI names
 */
export function getAllAINames(): readonly string[] {
  return AI_NAMES;
}
