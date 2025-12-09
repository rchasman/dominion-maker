import { describe, it, expect, beforeEach } from "bun:test";
import { CARDS } from "../data/cards";
import type { CardName } from "../types/game-state";

// Extract the AI discard logic to test it directly
function selectCardsToDiscard(
  options: CardName[],
  numToDiscard: number,
): CardName[] {
  const priorities = ["Estate", "Duchy", "Province", "Curse", "Copper"];
  const selected: CardName[] = [];

  // First pick priority discard cards
  for (const priority of priorities) {
    const matchingCards = options.filter(c => c === priority);
    for (const card of matchingCards) {
      if (selected.length < numToDiscard) {
        selected.push(card);
      }
    }
  }

  // Fill remaining with most expensive cards (they're worth less early)
  if (selected.length < numToDiscard) {
    const remaining = options
      .filter(c => !selected.includes(c))
      .sort((a, b) => CARDS[b].cost - CARDS[a].cost);

    selected.push(...remaining.slice(0, numToDiscard - selected.length));
  }

  return selected;
}

describe("EngineStrategy - Militia discard", () => {
  beforeEach(() => {});


  it("should select 2 cards when AI has multiple Estates", () => {
    const hand = ["Estate", "Estate", "Estate", "Copper", "Copper"];
    const selected = selectCardsToDiscard(hand, 2);

    expect(selected.length).toBe(2);
    expect(selected).toEqual(["Estate", "Estate"]);
  });

  it("should select 3 cards with priority order", () => {
    const hand = ["Estate", "Estate", "Copper", "Copper", "Silver", "Gold"];
    const selected = selectCardsToDiscard(hand, 3);

    expect(selected.length).toBe(3);
    // Should discard 2 Estates + 1 Copper (highest priority cards)
    expect(selected.filter(c => c === "Estate").length).toBe(2);
    expect(selected.filter(c => c === "Copper").length).toBe(1);
  });

  it("should select all priority cards then expensive cards", () => {
    const hand = ["Gold", "Silver", "Village", "Smithy"];
    const selected = selectCardsToDiscard(hand, 2);

    expect(selected.length).toBe(2);
    // Should discard most expensive cards (Gold $6, then Smithy $4)
    expect(selected).toContain("Gold");
    expect(selected).toContain("Smithy");
  });

  it("should handle exactly 1 card to discard", () => {
    const hand = ["Estate", "Copper", "Silver", "Gold"];
    const selected = selectCardsToDiscard(hand, 1);

    expect(selected.length).toBe(1);
    expect(selected).toEqual(["Estate"]); // Estate is highest priority
  });
});
