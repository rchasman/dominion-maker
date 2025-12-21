import { describe, it, expect } from "bun:test";
import { buildCardDefinitionsTable, buildSystemPrompt } from "./system-prompt";
import type { CardName } from "../types/game-state";

describe("buildCardDefinitionsTable", () => {
  it("should build table with cards in supply", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Silver: 40,
      Gold: 30,
      Estate: 8,
    };

    const table = buildCardDefinitionsTable(supply);

    // Should be TOON encoded format with tab delimiters
    expect(table).toContain("name\tcost\ttypes");
    expect(table).toContain("Copper");
    expect(table).toContain("Silver");
    expect(table).toContain("Gold");
    expect(table).toContain("Estate");
  });

  it("should include card costs", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Silver: 40,
    };

    const table = buildCardDefinitionsTable(supply);

    expect(table).toContain("cost");
    expect(table).toContain("\t0\t"); // Copper cost
    expect(table).toContain("\t3\t"); // Silver cost
  });

  it("should include card types", () => {
    const supply: Record<CardName, number> = {
      Village: 10,
      Smithy: 10,
    };

    const table = buildCardDefinitionsTable(supply);

    expect(table).toContain("types");
    expect(table).toContain("action"); // Types are lowercase in TOON
  });

  it("should include card effects", () => {
    const supply: Record<CardName, number> = {
      Village: 10,
    };

    const table = buildCardDefinitionsTable(supply);

    expect(table).toContain("effect");
    expect(table).toContain("+1 Card"); // Village effect
  });

  it("should only include cards in supply", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Silver: 40,
    };

    const table = buildCardDefinitionsTable(supply);

    expect(table).toContain("Copper");
    expect(table).toContain("Silver");
    expect(table).not.toContain("Gold"); // Not in supply
    expect(table).not.toContain("Province"); // Not in supply
  });

  it("should handle empty supply", () => {
    const supply: Record<CardName, number> = {};

    const table = buildCardDefinitionsTable(supply);

    // Should return valid TOON format even if empty
    expect(table).toBeTruthy();
  });
});

describe("buildSystemPrompt", () => {
  it("should include game rules", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Silver: 40,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("Dominion");
    expect(prompt).toContain("Deck-building"); // Capitalized in prompt
    expect(prompt).toContain("VP");
  });

  it("should include turn phases", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("Action");
    expect(prompt).toContain("Buy");
    expect(prompt).toContain("Cleanup");
  });

  it("should include resource information", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("currentActions");
    expect(prompt).toContain("currentBuys");
    expect(prompt).toContain("currentCoins");
  });

  it("should include starting deck composition", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Estate: 8,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("STARTING DECK");
    expect(prompt).toContain("7 Copper");
    expect(prompt).toContain("3 Estate");
  });

  it("should include card definitions table", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Silver: 40,
      Village: 10,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("CARD DEFINITIONS");
    expect(prompt).toContain("Copper");
    expect(prompt).toContain("Silver");
    expect(prompt).toContain("Village");
  });

  it("should include critical buy phase rule", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("CRITICAL BUY PHASE RULE");
    expect(prompt).toContain("currentTreasuresInHand");
    expect(prompt).toContain("play_treasure");
  });

  it("should include validation rules", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("VALIDATION");
    expect(prompt).toContain("play_action");
    expect(prompt).toContain("buy_card");
    expect(prompt).toContain("you.currentHand");
  });

  it("should include strategy override rules", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("STRATEGY OVERRIDE RULES");
    expect(prompt).toContain("strategyOverride");
    expect(prompt).toContain("IGNORE ALL default");
  });

  it("should include default decision framework", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Silver: 40,
      Gold: 30,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("DEFAULT DECISION FRAMEWORK");
    expect(prompt).toContain("Treasure hierarchy");
    expect(prompt).toContain("Gold (+3) > Silver (+2) > Copper (+1)");
  });

  it("should include copper trap warning", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("Copper trap");
    expect(prompt).toContain("You START with 7 Copper"); // Capitalized "You"
    expect(prompt).toContain("Almost never buy Copper");
  });

  it("should include skip buy advice", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Estate: 8,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("Skip the buy");
    expect(prompt).toContain("Not buying > buying junk");
  });

  it("should include victory timing advice", () => {
    const supply: Record<CardName, number> = {
      Province: 8,
      Duchy: 8,
      Estate: 8,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("Victory timing");
    expect(prompt).toContain("Province");
    expect(prompt).toContain("Game ending soon");
  });

  it("should include dilution math explanation", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("Dilution math");
    expect(prompt).toContain("10-card deck");
    expect(prompt).toContain("5 cards/turn");
  });

  it("should include action card evaluation", () => {
    const supply: Record<CardName, number> = {
      Village: 10,
      Smithy: 10,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("Action cards");
    expect(prompt).toContain("+Cards");
    expect(prompt).toContain("+Actions");
    expect(prompt).toContain("Terminals");
  });

  it("should include topdeck vs trash clarification", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toContain("topdeck_card");
    expect(prompt).toContain("top of deck");
    expect(prompt).toContain("Trash removes forever");
  });

  it("should work with minimal supply", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toBeTruthy();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("should work with full game supply", () => {
    const supply: Record<CardName, number> = {
      Copper: 46,
      Silver: 40,
      Gold: 30,
      Estate: 8,
      Duchy: 8,
      Province: 8,
      Village: 10,
      Smithy: 10,
      Market: 10,
      Laboratory: 10,
    };

    const prompt = buildSystemPrompt(supply);

    expect(prompt).toBeTruthy();
    expect(prompt).toContain("Village");
    expect(prompt).toContain("Smithy");
    expect(prompt).toContain("Market");
    expect(prompt).toContain("Laboratory");
  });
});
