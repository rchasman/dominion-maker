import { describe, it, expect } from "bun:test";
import {
  CARDS,
  KINGDOM_CARDS,
  FIRST_GAME_KINGDOM,
  isActionCard,
  isTreasureCard,
  isSimpleTreasure,
  isVictoryCard,
  isAttackCard,
  isReactionCard,
} from "./cards";
import type { CardName } from "../types/game-state";

describe("CARDS - data integrity", () => {
  it("should have all required properties for each card", () => {
    Object.entries(CARDS).forEach(([name, card]) => {
      expect(card.name).toBe(name as CardName);
      expect(typeof card.cost).toBe("number");
      expect(Array.isArray(card.types)).toBe(true);
      expect(card.types.length).toBeGreaterThan(0);
      expect(typeof card.description).toBe("string");
    });
  });

  it("should have coins property for treasure cards", () => {
    const treasures: CardName[] = ["Copper", "Silver", "Gold"];
    treasures.forEach(name => {
      expect(CARDS[name].coins).toBeDefined();
      expect(typeof CARDS[name].coins).toBe("number");
    });
  });

  it("should have vp property for victory cards", () => {
    const victoryCards: CardName[] = ["Estate", "Duchy", "Province", "Gardens"];
    victoryCards.forEach(name => {
      expect(CARDS[name].vp).toBeDefined();
    });
  });

  it("should have reactionTrigger for reaction cards", () => {
    const reactionCards = Object.values(CARDS).filter(card =>
      card.types.includes("reaction"),
    );
    reactionCards.forEach(card => {
      expect(card.reactionTrigger).toBeDefined();
    });
  });

  it("should have valid cost values", () => {
    Object.values(CARDS).forEach(card => {
      expect(card.cost).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(card.cost)).toBe(true);
    });
  });

  it("should have valid type arrays", () => {
    const validTypes = [
      "treasure",
      "victory",
      "curse",
      "action",
      "attack",
      "reaction",
    ];
    Object.values(CARDS).forEach(card => {
      card.types.forEach(type => {
        expect(validTypes).toContain(type);
      });
    });
  });
});

describe("CARDS - specific cards", () => {
  it("should define Copper correctly", () => {
    expect(CARDS.Copper).toEqual({
      name: "Copper",
      cost: 0,
      types: ["treasure"],
      description: "+$1",
      coins: 1,
    });
  });

  it("should define Silver correctly", () => {
    expect(CARDS.Silver).toEqual({
      name: "Silver",
      cost: 3,
      types: ["treasure"],
      description: "+$2",
      coins: 2,
    });
  });

  it("should define Gold correctly", () => {
    expect(CARDS.Gold).toEqual({
      name: "Gold",
      cost: 6,
      types: ["treasure"],
      description: "+$3",
      coins: 3,
    });
  });

  it("should define Estate correctly", () => {
    expect(CARDS.Estate).toEqual({
      name: "Estate",
      cost: 2,
      types: ["victory"],
      description: "1 VP",
      vp: 1,
    });
  });

  it("should define Duchy correctly", () => {
    expect(CARDS.Duchy).toEqual({
      name: "Duchy",
      cost: 5,
      types: ["victory"],
      description: "3 VP",
      vp: 3,
    });
  });

  it("should define Province correctly", () => {
    expect(CARDS.Province).toEqual({
      name: "Province",
      cost: 8,
      types: ["victory"],
      description: "6 VP",
      vp: 6,
    });
  });

  it("should define Curse correctly", () => {
    expect(CARDS.Curse).toEqual({
      name: "Curse",
      cost: 0,
      types: ["curse"],
      description: "-1 VP",
      vp: -1,
    });
  });

  it("should define Gardens with variable VP", () => {
    expect(CARDS.Gardens.vp).toBe("variable");
    expect(CARDS.Gardens.types).toContain("victory");
  });

  it("should define Moat as reaction card", () => {
    expect(CARDS.Moat.types).toContain("reaction");
    expect(CARDS.Moat.reactionTrigger).toBe("on_attack");
  });

  it("should define Merchant with trigger", () => {
    expect(CARDS.Merchant.triggers).toBeDefined();
    expect(CARDS.Merchant.triggers?.length).toBe(1);
    expect(CARDS.Merchant.triggers?.[0]?.on).toBe("treasure_played");
  });
});

describe("KINGDOM_CARDS", () => {
  it("should contain exactly 26 kingdom cards", () => {
    expect(KINGDOM_CARDS.length).toBe(26);
  });

  it("should not include base treasures", () => {
    expect(KINGDOM_CARDS).not.toContain("Copper");
    expect(KINGDOM_CARDS).not.toContain("Silver");
    expect(KINGDOM_CARDS).not.toContain("Gold");
  });

  it("should not include base victory cards", () => {
    expect(KINGDOM_CARDS).not.toContain("Estate");
    expect(KINGDOM_CARDS).not.toContain("Duchy");
    expect(KINGDOM_CARDS).not.toContain("Province");
  });

  it("should not include Curse", () => {
    expect(KINGDOM_CARDS).not.toContain("Curse");
  });

  it("should only contain cards that exist in CARDS", () => {
    KINGDOM_CARDS.forEach(cardName => {
      expect(CARDS[cardName]).toBeDefined();
    });
  });

  it("should contain all action cards", () => {
    const expectedKingdom: CardName[] = [
      "Cellar",
      "Chapel",
      "Moat",
      "Harbinger",
      "Merchant",
      "Vassal",
      "Village",
      "Workshop",
      "Bureaucrat",
      "Gardens",
      "Militia",
      "Moneylender",
      "Poacher",
      "Remodel",
      "Smithy",
      "Throne Room",
      "Bandit",
      "Council Room",
      "Festival",
      "Laboratory",
      "Library",
      "Market",
      "Mine",
      "Sentry",
      "Witch",
      "Artisan",
    ];
    expect(KINGDOM_CARDS).toEqual(expectedKingdom);
  });
});

describe("FIRST_GAME_KINGDOM", () => {
  it("should contain exactly 10 cards", () => {
    expect(FIRST_GAME_KINGDOM.length).toBe(10);
  });

  it("should only contain cards from KINGDOM_CARDS", () => {
    FIRST_GAME_KINGDOM.forEach(cardName => {
      expect(KINGDOM_CARDS).toContain(cardName);
    });
  });

  it("should only contain cards that exist in CARDS", () => {
    FIRST_GAME_KINGDOM.forEach(cardName => {
      expect(CARDS[cardName]).toBeDefined();
    });
  });

  it("should contain recommended first game cards", () => {
    const expected: CardName[] = [
      "Cellar",
      "Market",
      "Militia",
      "Mine",
      "Moat",
      "Remodel",
      "Smithy",
      "Village",
      "Workshop",
      "Moneylender",
    ];
    expect(FIRST_GAME_KINGDOM).toEqual(expected);
  });
});

describe("isActionCard", () => {
  it("should return true for action cards", () => {
    expect(isActionCard("Village")).toBe(true);
    expect(isActionCard("Smithy")).toBe(true);
    expect(isActionCard("Market")).toBe(true);
  });

  it("should return false for non-action cards", () => {
    expect(isActionCard("Copper")).toBe(false);
    expect(isActionCard("Silver")).toBe(false);
    expect(isActionCard("Estate")).toBe(false);
    expect(isActionCard("Curse")).toBe(false);
  });

  it("should return true for attack cards (which are also actions)", () => {
    expect(isActionCard("Militia")).toBe(true);
    expect(isActionCard("Witch")).toBe(true);
  });

  it("should return true for reaction cards that are also actions", () => {
    expect(isActionCard("Moat")).toBe(true);
  });

  it("should handle all action cards in KINGDOM_CARDS", () => {
    const actionCards = KINGDOM_CARDS.filter(card =>
      CARDS[card].types.includes("action"),
    );
    actionCards.forEach(card => {
      expect(isActionCard(card)).toBe(true);
    });
  });
});

describe("isTreasureCard", () => {
  it("should return true for treasure cards", () => {
    expect(isTreasureCard("Copper")).toBe(true);
    expect(isTreasureCard("Silver")).toBe(true);
    expect(isTreasureCard("Gold")).toBe(true);
  });

  it("should return false for non-treasure cards", () => {
    expect(isTreasureCard("Village")).toBe(false);
    expect(isTreasureCard("Estate")).toBe(false);
    expect(isTreasureCard("Curse")).toBe(false);
  });

  it("should handle all treasure cards in CARDS", () => {
    const treasures = Object.keys(CARDS).filter(card =>
      CARDS[card as CardName].types.includes("treasure"),
    );
    treasures.forEach(card => {
      expect(isTreasureCard(card as CardName)).toBe(true);
    });
  });
});

describe("isSimpleTreasure", () => {
  it("should return true for basic treasures (Copper, Silver, Gold)", () => {
    expect(isSimpleTreasure("Copper")).toBe(true);
    expect(isSimpleTreasure("Silver")).toBe(true);
    expect(isSimpleTreasure("Gold")).toBe(true);
  });

  it("should return false for non-treasure cards", () => {
    expect(isSimpleTreasure("Village")).toBe(false);
    expect(isSimpleTreasure("Estate")).toBe(false);
  });

  it("should match all current treasures since base set has no complex treasures", () => {
    const treasures = Object.keys(CARDS).filter(card =>
      CARDS[card as CardName].types.includes("treasure"),
    );
    treasures.forEach(card => {
      expect(isSimpleTreasure(card as CardName)).toBe(true);
    });
  });
});

describe("isVictoryCard", () => {
  it("should return true for victory cards", () => {
    expect(isVictoryCard("Estate")).toBe(true);
    expect(isVictoryCard("Duchy")).toBe(true);
    expect(isVictoryCard("Province")).toBe(true);
  });

  it("should return true for Gardens", () => {
    expect(isVictoryCard("Gardens")).toBe(true);
  });

  it("should return false for non-victory cards", () => {
    expect(isVictoryCard("Copper")).toBe(false);
    expect(isVictoryCard("Village")).toBe(false);
    expect(isVictoryCard("Curse")).toBe(false);
  });

  it("should handle all victory cards in CARDS", () => {
    const victories = Object.keys(CARDS).filter(card =>
      CARDS[card as CardName].types.includes("victory"),
    );
    victories.forEach(card => {
      expect(isVictoryCard(card as CardName)).toBe(true);
    });
  });
});

describe("isAttackCard", () => {
  it("should return true for attack cards", () => {
    expect(isAttackCard("Militia")).toBe(true);
    expect(isAttackCard("Witch")).toBe(true);
    expect(isAttackCard("Bandit")).toBe(true);
  });

  it("should return false for non-attack cards", () => {
    expect(isAttackCard("Village")).toBe(false);
    expect(isAttackCard("Smithy")).toBe(false);
    expect(isAttackCard("Copper")).toBe(false);
  });

  it("should handle all attack cards in KINGDOM_CARDS", () => {
    const attacks = KINGDOM_CARDS.filter(card =>
      CARDS[card].types.includes("attack"),
    );
    attacks.forEach(card => {
      expect(isAttackCard(card)).toBe(true);
    });
  });
});

describe("isReactionCard", () => {
  it("should return true for reaction cards", () => {
    expect(isReactionCard("Moat")).toBe(true);
  });

  it("should return false for non-reaction cards", () => {
    expect(isReactionCard("Village")).toBe(false);
    expect(isReactionCard("Militia")).toBe(false);
    expect(isReactionCard("Copper")).toBe(false);
  });

  it("should handle all reaction cards in CARDS", () => {
    const reactions = Object.keys(CARDS).filter(card =>
      CARDS[card as CardName].types.includes("reaction"),
    );
    reactions.forEach(card => {
      expect(isReactionCard(card as CardName)).toBe(true);
    });
  });
});

describe("Card triggers", () => {
  it("should have proper trigger structure for Merchant", () => {
    const trigger = CARDS.Merchant.triggers?.[0];
    expect(trigger).toBeDefined();
    expect(trigger?.on).toBe("treasure_played");
    expect(typeof trigger?.condition).toBe("function");
    expect(typeof trigger?.effect).toBe("function");
  });

  it("should verify Merchant trigger condition", () => {
    const trigger = CARDS.Merchant.triggers?.[0];
    expect(trigger?.condition?.({ card: "Silver", isFirstOfType: true })).toBe(
      true,
    );
    expect(trigger?.condition?.({ card: "Silver", isFirstOfType: false })).toBe(
      false,
    );
    expect(trigger?.condition?.({ card: "Gold", isFirstOfType: true })).toBe(
      false,
    );
  });

  it("should verify Merchant trigger effect", () => {
    const trigger = CARDS.Merchant.triggers?.[0];
    const events = trigger?.effect?.({ card: "Silver", isFirstOfType: true });
    expect(events).toEqual([{ type: "COINS_MODIFIED", delta: 1 }]);
  });
});

describe("Card costs by tier", () => {
  it("should have correct cost 2 cards", () => {
    expect(CARDS.Cellar.cost).toBe(2);
    expect(CARDS.Chapel.cost).toBe(2);
    expect(CARDS.Moat.cost).toBe(2);
  });

  it("should have correct cost 3 cards", () => {
    expect(CARDS.Harbinger.cost).toBe(3);
    expect(CARDS.Merchant.cost).toBe(3);
    expect(CARDS.Vassal.cost).toBe(3);
    expect(CARDS.Village.cost).toBe(3);
    expect(CARDS.Workshop.cost).toBe(3);
  });

  it("should have correct cost 4 cards", () => {
    expect(CARDS.Bureaucrat.cost).toBe(4);
    expect(CARDS.Gardens.cost).toBe(4);
    expect(CARDS.Militia.cost).toBe(4);
    expect(CARDS.Moneylender.cost).toBe(4);
    expect(CARDS.Poacher.cost).toBe(4);
    expect(CARDS.Remodel.cost).toBe(4);
    expect(CARDS.Smithy.cost).toBe(4);
    expect(CARDS["Throne Room"].cost).toBe(4);
  });

  it("should have correct cost 5 cards", () => {
    expect(CARDS.Bandit.cost).toBe(5);
    expect(CARDS["Council Room"].cost).toBe(5);
    expect(CARDS.Festival.cost).toBe(5);
    expect(CARDS.Laboratory.cost).toBe(5);
    expect(CARDS.Library.cost).toBe(5);
    expect(CARDS.Market.cost).toBe(5);
    expect(CARDS.Mine.cost).toBe(5);
    expect(CARDS.Sentry.cost).toBe(5);
    expect(CARDS.Witch.cost).toBe(5);
  });

  it("should have correct cost 6 cards", () => {
    expect(CARDS.Artisan.cost).toBe(6);
  });
});

describe("Card type combinations", () => {
  it("should identify cards with multiple types", () => {
    expect(CARDS.Moat.types).toEqual(["action", "reaction"]);
    expect(CARDS.Militia.types).toEqual(["action", "attack"]);
    expect(CARDS.Witch.types).toEqual(["action", "attack"]);
  });

  it("should verify all attack cards are also actions", () => {
    const attackCards = Object.values(CARDS).filter(card =>
      card.types.includes("attack"),
    );
    attackCards.forEach(card => {
      expect(card.types).toContain("action");
    });
  });

  it("should verify Moat is the only reaction card in base set", () => {
    const reactionCards = Object.values(CARDS).filter(card =>
      card.types.includes("reaction"),
    );
    expect(reactionCards.length).toBe(1);
    expect(reactionCards[0]!.name).toBe("Moat");
  });
});
