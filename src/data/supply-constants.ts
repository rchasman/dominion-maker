/**
 * Official Dominion supply pile counts
 * Based on official rules from Rio Grande Games
 */

/** Starting deck composition for each player */
export const STARTING_DECK = {
  COPPER: 7,
  ESTATE: 3,
} as const;

/** Base treasure supply counts (before removing starting decks) */
export const TREASURE_SUPPLY = {
  /** Total Copper in base set */
  COPPER_TOTAL: 60,
  /** Silver cards in supply */
  SILVER: 40,
  /** Gold cards in supply */
  GOLD: 30,
} as const;

/** Victory card counts by player count */
export const VICTORY_CARDS_BY_PLAYERS = {
  2: 8,
  3: 12,
  4: 12,
  5: 15, // Provinces only; Estate/Duchy remain 12
  6: 18, // Provinces only; Estate/Duchy remain 12
} as const;

/** Curse card counts by player count */
export const CURSE_CARDS_BY_PLAYERS = {
  2: 10,
  3: 20,
  4: 30,
  5: 40,
  6: 50,
} as const;

/** Kingdom card counts by player count */
export const KINGDOM_CARDS_BY_PLAYERS = {
  2: 8,
  3: 10,
  4: 10,
  5: 10,
  6: 10,
} as const;

/** Helper to get victory card count for a player count */
export function getVictoryCardCount(
  playerCount: number,
  cardType: "Province" | "Duchy" | "Estate",
): number {
  const counts = VICTORY_CARDS_BY_PLAYERS[
    playerCount as keyof typeof VICTORY_CARDS_BY_PLAYERS
  ] || VICTORY_CARDS_BY_PLAYERS[4];

  // Provinces scale for 5-6 players, Duchy/Estate stay at 12
  if (playerCount >= 5 && cardType !== "Province") {
    return VICTORY_CARDS_BY_PLAYERS[4];
  }

  return counts;
}

/** Helper to get curse card count for a player count */
export function getCurseCardCount(playerCount: number): number {
  return (
    CURSE_CARDS_BY_PLAYERS[
      playerCount as keyof typeof CURSE_CARDS_BY_PLAYERS
    ] || CURSE_CARDS_BY_PLAYERS[4]
  );
}

/** Helper to get kingdom card count for a player count */
export function getKingdomCardCount(playerCount: number): number {
  return (
    KINGDOM_CARDS_BY_PLAYERS[
      playerCount as keyof typeof KINGDOM_CARDS_BY_PLAYERS
    ] || KINGDOM_CARDS_BY_PLAYERS[4]
  );
}

/** Helper to calculate remaining Copper after dealing starting decks */
export function getCopperSupplyCount(playerCount: number): number {
  return TREASURE_SUPPLY.COPPER_TOTAL - playerCount * STARTING_DECK.COPPER;
}
