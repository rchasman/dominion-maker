/**
 * Basic type definitions shared across the type system
 * Extracted to avoid circular dependencies
 */

// Card names for base game
export type CardName =
  // Treasures
  | "Copper"
  | "Silver"
  | "Gold"
  // Victory
  | "Estate"
  | "Duchy"
  | "Province"
  // Curse
  | "Curse"
  // Kingdom cards (base game 2nd edition)
  | "Cellar"
  | "Chapel"
  | "Moat"
  | "Harbinger"
  | "Merchant"
  | "Vassal"
  | "Village"
  | "Workshop"
  | "Bureaucrat"
  | "Gardens"
  | "Militia"
  | "Moneylender"
  | "Poacher"
  | "Remodel"
  | "Smithy"
  | "Throne Room"
  | "Bandit"
  | "Council Room"
  | "Festival"
  | "Laboratory"
  | "Library"
  | "Market"
  | "Mine"
  | "Sentry"
  | "Witch"
  | "Artisan";

// Player identifiers
// For single-player: "human" vs "ai"
// For multiplayer: "player0", "player1", etc.
export type PlayerId = string; // ClientId strings
