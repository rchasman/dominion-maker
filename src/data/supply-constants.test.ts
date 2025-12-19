import { describe, it, expect } from "bun:test";
import {
  STARTING_DECK,
  TREASURE_SUPPLY,
  VICTORY_CARDS_BY_PLAYERS,
  CURSE_CARDS_BY_PLAYERS,
  KINGDOM_CARDS_BY_PLAYERS,
  getVictoryCardCount,
  getCurseCardCount,
  getKingdomCardCount,
  getCopperSupplyCount,
} from "./supply-constants";

describe("STARTING_DECK", () => {
  it("should have correct Copper count", () => {
    expect(STARTING_DECK.COPPER).toBe(7);
  });

  it("should have correct Estate count", () => {
    expect(STARTING_DECK.ESTATE).toBe(3);
  });

  it("should have exactly 10 cards total", () => {
    const total = STARTING_DECK.COPPER + STARTING_DECK.ESTATE;
    expect(total).toBe(10);
  });
});

describe("TREASURE_SUPPLY", () => {
  it("should have correct total Copper", () => {
    expect(TREASURE_SUPPLY.COPPER_TOTAL).toBe(60);
  });

  it("should have correct Silver count", () => {
    expect(TREASURE_SUPPLY.SILVER).toBe(40);
  });

  it("should have correct Gold count", () => {
    expect(TREASURE_SUPPLY.GOLD).toBe(30);
  });
});

describe("VICTORY_CARDS_BY_PLAYERS", () => {
  it("should have 8 cards for 2 players", () => {
    expect(VICTORY_CARDS_BY_PLAYERS[2]).toBe(8);
  });

  it("should have 12 cards for 3 players", () => {
    expect(VICTORY_CARDS_BY_PLAYERS[3]).toBe(12);
  });

  it("should have 12 cards for 4 players", () => {
    expect(VICTORY_CARDS_BY_PLAYERS[4]).toBe(12);
  });

  it("should have 15 cards for 5 players", () => {
    expect(VICTORY_CARDS_BY_PLAYERS[5]).toBe(15);
  });

  it("should have 18 cards for 6 players", () => {
    expect(VICTORY_CARDS_BY_PLAYERS[6]).toBe(18);
  });

  it("should support all player counts 2-6", () => {
    expect(Object.keys(VICTORY_CARDS_BY_PLAYERS)).toEqual([
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
  });
});

describe("CURSE_CARDS_BY_PLAYERS", () => {
  it("should have 10 curses for 2 players", () => {
    expect(CURSE_CARDS_BY_PLAYERS[2]).toBe(10);
  });

  it("should have 20 curses for 3 players", () => {
    expect(CURSE_CARDS_BY_PLAYERS[3]).toBe(20);
  });

  it("should have 30 curses for 4 players", () => {
    expect(CURSE_CARDS_BY_PLAYERS[4]).toBe(30);
  });

  it("should have 40 curses for 5 players", () => {
    expect(CURSE_CARDS_BY_PLAYERS[5]).toBe(40);
  });

  it("should have 50 curses for 6 players", () => {
    expect(CURSE_CARDS_BY_PLAYERS[6]).toBe(50);
  });

  it("should scale by 10 per player", () => {
    expect(CURSE_CARDS_BY_PLAYERS[3] - CURSE_CARDS_BY_PLAYERS[2]).toBe(10);
    expect(CURSE_CARDS_BY_PLAYERS[4] - CURSE_CARDS_BY_PLAYERS[3]).toBe(10);
    expect(CURSE_CARDS_BY_PLAYERS[5] - CURSE_CARDS_BY_PLAYERS[4]).toBe(10);
    expect(CURSE_CARDS_BY_PLAYERS[6] - CURSE_CARDS_BY_PLAYERS[5]).toBe(10);
  });
});

describe("KINGDOM_CARDS_BY_PLAYERS", () => {
  it("should have 8 cards for 2 players", () => {
    expect(KINGDOM_CARDS_BY_PLAYERS[2]).toBe(8);
  });

  it("should have 10 cards for 3 players", () => {
    expect(KINGDOM_CARDS_BY_PLAYERS[3]).toBe(10);
  });

  it("should have 10 cards for 4 players", () => {
    expect(KINGDOM_CARDS_BY_PLAYERS[4]).toBe(10);
  });

  it("should have 10 cards for 5 players", () => {
    expect(KINGDOM_CARDS_BY_PLAYERS[5]).toBe(10);
  });

  it("should have 10 cards for 6 players", () => {
    expect(KINGDOM_CARDS_BY_PLAYERS[6]).toBe(10);
  });

  it("should cap at 10 for 3+ players", () => {
    expect(KINGDOM_CARDS_BY_PLAYERS[3]).toBe(10);
    expect(KINGDOM_CARDS_BY_PLAYERS[4]).toBe(10);
    expect(KINGDOM_CARDS_BY_PLAYERS[5]).toBe(10);
    expect(KINGDOM_CARDS_BY_PLAYERS[6]).toBe(10);
  });
});

describe("getVictoryCardCount", () => {
  it("should return 8 for 2 players", () => {
    expect(getVictoryCardCount(2, "Province")).toBe(8);
    expect(getVictoryCardCount(2, "Duchy")).toBe(8);
    expect(getVictoryCardCount(2, "Estate")).toBe(8);
  });

  it("should return 12 for 3 players", () => {
    expect(getVictoryCardCount(3, "Province")).toBe(12);
    expect(getVictoryCardCount(3, "Duchy")).toBe(12);
    expect(getVictoryCardCount(3, "Estate")).toBe(12);
  });

  it("should return 12 for 4 players", () => {
    expect(getVictoryCardCount(4, "Province")).toBe(12);
    expect(getVictoryCardCount(4, "Duchy")).toBe(12);
    expect(getVictoryCardCount(4, "Estate")).toBe(12);
  });

  it("should return 15 Provinces for 5 players", () => {
    expect(getVictoryCardCount(5, "Province")).toBe(15);
  });

  it("should return 12 Duchy/Estate for 5 players", () => {
    expect(getVictoryCardCount(5, "Duchy")).toBe(12);
    expect(getVictoryCardCount(5, "Estate")).toBe(12);
  });

  it("should return 18 Provinces for 6 players", () => {
    expect(getVictoryCardCount(6, "Province")).toBe(18);
  });

  it("should return 12 Duchy/Estate for 6 players", () => {
    expect(getVictoryCardCount(6, "Duchy")).toBe(12);
    expect(getVictoryCardCount(6, "Estate")).toBe(12);
  });

  it("should default to 4 player count for invalid counts", () => {
    expect(getVictoryCardCount(0, "Province")).toBe(12);
    expect(getVictoryCardCount(1, "Province")).toBe(12);
    expect(getVictoryCardCount(7, "Province")).toBe(12);
    expect(getVictoryCardCount(10, "Province")).toBe(12);
  });

  it("should default to 12 for Duchy/Estate on invalid high counts", () => {
    expect(getVictoryCardCount(7, "Duchy")).toBe(12);
    expect(getVictoryCardCount(7, "Estate")).toBe(12);
  });
});

describe("getCurseCardCount", () => {
  it("should return correct count for each player count", () => {
    expect(getCurseCardCount(2)).toBe(10);
    expect(getCurseCardCount(3)).toBe(20);
    expect(getCurseCardCount(4)).toBe(30);
    expect(getCurseCardCount(5)).toBe(40);
    expect(getCurseCardCount(6)).toBe(50);
  });

  it("should default to 4 player count for invalid counts", () => {
    expect(getCurseCardCount(0)).toBe(30);
    expect(getCurseCardCount(1)).toBe(30);
    expect(getCurseCardCount(7)).toBe(30);
    expect(getCurseCardCount(10)).toBe(30);
  });

  it("should handle negative player counts", () => {
    expect(getCurseCardCount(-1)).toBe(30);
    expect(getCurseCardCount(-5)).toBe(30);
  });
});

describe("getKingdomCardCount", () => {
  it("should return 8 for 2 players", () => {
    expect(getKingdomCardCount(2)).toBe(8);
  });

  it("should return 10 for 3+ players", () => {
    expect(getKingdomCardCount(3)).toBe(10);
    expect(getKingdomCardCount(4)).toBe(10);
    expect(getKingdomCardCount(5)).toBe(10);
    expect(getKingdomCardCount(6)).toBe(10);
  });

  it("should default to 4 player count for invalid counts", () => {
    expect(getKingdomCardCount(0)).toBe(10);
    expect(getKingdomCardCount(1)).toBe(10);
    expect(getKingdomCardCount(7)).toBe(10);
    expect(getKingdomCardCount(10)).toBe(10);
  });

  it("should handle negative player counts", () => {
    expect(getKingdomCardCount(-1)).toBe(10);
    expect(getKingdomCardCount(-5)).toBe(10);
  });
});

describe("getCopperSupplyCount", () => {
  it("should return correct count for 2 players", () => {
    const expected = TREASURE_SUPPLY.COPPER_TOTAL - 2 * STARTING_DECK.COPPER;
    expect(getCopperSupplyCount(2)).toBe(expected);
    expect(getCopperSupplyCount(2)).toBe(60 - 14);
    expect(getCopperSupplyCount(2)).toBe(46);
  });

  it("should return correct count for 3 players", () => {
    const expected = TREASURE_SUPPLY.COPPER_TOTAL - 3 * STARTING_DECK.COPPER;
    expect(getCopperSupplyCount(3)).toBe(expected);
    expect(getCopperSupplyCount(3)).toBe(60 - 21);
    expect(getCopperSupplyCount(3)).toBe(39);
  });

  it("should return correct count for 4 players", () => {
    const expected = TREASURE_SUPPLY.COPPER_TOTAL - 4 * STARTING_DECK.COPPER;
    expect(getCopperSupplyCount(4)).toBe(expected);
    expect(getCopperSupplyCount(4)).toBe(60 - 28);
    expect(getCopperSupplyCount(4)).toBe(32);
  });

  it("should return correct count for 5 players", () => {
    const expected = TREASURE_SUPPLY.COPPER_TOTAL - 5 * STARTING_DECK.COPPER;
    expect(getCopperSupplyCount(5)).toBe(expected);
    expect(getCopperSupplyCount(5)).toBe(60 - 35);
    expect(getCopperSupplyCount(5)).toBe(25);
  });

  it("should return correct count for 6 players", () => {
    const expected = TREASURE_SUPPLY.COPPER_TOTAL - 6 * STARTING_DECK.COPPER;
    expect(getCopperSupplyCount(6)).toBe(expected);
    expect(getCopperSupplyCount(6)).toBe(60 - 42);
    expect(getCopperSupplyCount(6)).toBe(18);
  });

  it("should handle 1 player (for testing)", () => {
    expect(getCopperSupplyCount(1)).toBe(60 - 7);
    expect(getCopperSupplyCount(1)).toBe(53);
  });

  it("should decrease by 7 per additional player", () => {
    expect(getCopperSupplyCount(2) - getCopperSupplyCount(3)).toBe(7);
    expect(getCopperSupplyCount(3) - getCopperSupplyCount(4)).toBe(7);
    expect(getCopperSupplyCount(4) - getCopperSupplyCount(5)).toBe(7);
    expect(getCopperSupplyCount(5) - getCopperSupplyCount(6)).toBe(7);
  });

  it("should handle edge case of 0 players", () => {
    expect(getCopperSupplyCount(0)).toBe(60);
  });

  it("should return negative for unrealistic player counts", () => {
    expect(getCopperSupplyCount(10)).toBe(60 - 70);
    expect(getCopperSupplyCount(10)).toBe(-10);
  });
});

describe("Supply constants - official rules validation", () => {
  it("should match official Dominion supply rules", () => {
    expect(TREASURE_SUPPLY.COPPER_TOTAL).toBe(60);
    expect(TREASURE_SUPPLY.SILVER).toBe(40);
    expect(TREASURE_SUPPLY.GOLD).toBe(30);
  });

  it("should match official starting deck composition", () => {
    expect(STARTING_DECK.COPPER).toBe(7);
    expect(STARTING_DECK.ESTATE).toBe(3);
  });

  it("should match official victory pile rules", () => {
    expect(VICTORY_CARDS_BY_PLAYERS[2]).toBe(8);
    expect(VICTORY_CARDS_BY_PLAYERS[3]).toBe(12);
    expect(VICTORY_CARDS_BY_PLAYERS[4]).toBe(12);
  });

  it("should match official kingdom pile rules", () => {
    expect(KINGDOM_CARDS_BY_PLAYERS[2]).toBe(8);
    expect(KINGDOM_CARDS_BY_PLAYERS[3]).toBe(10);
  });
});

describe("Edge cases and boundaries", () => {
  it("should handle fractional player counts", () => {
    expect(getVictoryCardCount(2.5, "Province")).toBe(12);
    expect(getCurseCardCount(3.7)).toBe(30);
    expect(getKingdomCardCount(4.2)).toBe(10);
  });

  it("should handle very large player counts", () => {
    expect(getVictoryCardCount(100, "Province")).toBe(12);
    expect(getCurseCardCount(1000)).toBe(30);
    expect(getKingdomCardCount(999)).toBe(10);
  });

  it("should maintain consistency across helper functions", () => {
    for (let players = 2; players <= 6; players++) {
      const copperInSupply = getCopperSupplyCount(players);
      const copperInStartingDecks = players * STARTING_DECK.COPPER;
      const totalCopper = copperInSupply + copperInStartingDecks;
      expect(totalCopper).toBe(TREASURE_SUPPLY.COPPER_TOTAL);
    }
  });
});
