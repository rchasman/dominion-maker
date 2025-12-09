import { describe, it, expect } from "bun:test";
import { CARDS } from "../data/cards";
import type { CardName } from "../types/game-state";

// Extract the AI trash logic to test it directly
function selectCardsToTrash(
  options: CardName[],
  numToTrash: number,
): CardName[] {
  const trashPriorities = ["Curse", "Estate", "Copper"];
  const selected: CardName[] = [];

  // First pick priority trash cards
  for (const priority of trashPriorities) {
    const matchingCards = options.filter(c => c === priority);
    for (const card of matchingCards) {
      if (selected.length < numToTrash) {
        selected.push(card);
      }
    }
  }

  // Fill remaining with cheapest cards
  if (selected.length < numToTrash) {
    const remaining = options
      .filter(c => !selected.includes(c))
      .sort((a, b) => CARDS[a].cost - CARDS[b].cost); // Cheapest first

    selected.push(...remaining.slice(0, numToTrash - selected.length));
  }

  return selected;
}

// Extract the AI gain logic to test it directly
function selectCardsToGain(
  options: CardName[],
  numToGain: number,
): CardName[] {
  // Gain most expensive card available (simple heuristic)
  const sorted = [...options].sort((a, b) => CARDS[b].cost - CARDS[a].cost);
  return sorted.slice(0, numToGain);
}

describe("AI Strategy - Trash decisions", () => {
  it("should trash Estates before Silvers", () => {
    const hand = ["Estate", "Estate", "Silver", "Copper"];
    const selected = selectCardsToTrash(hand, 3);

    expect(selected.length).toBe(3);
    // Should trash 2 Estates + 1 Copper, keep Silver
    expect(selected.filter(c => c === "Estate").length).toBe(2);
    expect(selected.filter(c => c === "Copper").length).toBe(1);
    expect(selected).not.toContain("Silver");
  });

  it("should trash all Curses first", () => {
    const hand = ["Curse", "Curse", "Estate", "Copper", "Silver"];
    const selected = selectCardsToTrash(hand, 3);

    expect(selected.length).toBe(3);
    // Should trash 2 Curses + 1 Estate
    expect(selected.filter(c => c === "Curse").length).toBe(2);
    expect(selected.filter(c => c === "Estate").length).toBe(1);
  });

  it("should trash cheapest cards when no priority cards", () => {
    const hand = ["Silver", "Gold", "Village", "Smithy"];
    const selected = selectCardsToTrash(hand, 2);

    expect(selected.length).toBe(2);
    // Should trash cheapest: Silver ($3) and Village ($3)
    expect(selected).toContain("Silver");
    expect(selected).toContain("Village");
    // Should keep Gold ($6) and Smithy ($4)
    expect(selected).not.toContain("Gold");
  });

  it("should handle multiple copies of priority cards", () => {
    const hand = ["Estate", "Estate", "Estate", "Copper", "Copper"];
    const selected = selectCardsToTrash(hand, 4);

    expect(selected.length).toBe(4);
    // Should trash 3 Estates + 1 Copper
    expect(selected.filter(c => c === "Estate").length).toBe(3);
    expect(selected.filter(c => c === "Copper").length).toBe(1);
  });
});

describe("AI Strategy - Gain decisions", () => {
  it("should gain most expensive card available", () => {
    const options = ["Copper", "Silver", "Estate", "Village", "Smithy"];
    const selected = selectCardsToGain(options, 1);

    expect(selected.length).toBe(1);
    // Smithy costs $4, most expensive
    expect(selected[0]).toBe("Smithy");
  });

  it("should gain Gold over Silver", () => {
    const options = ["Copper", "Silver", "Gold"];
    const selected = selectCardsToGain(options, 1);

    expect(selected.length).toBe(1);
    expect(selected[0]).toBe("Gold");
  });

  it("should handle gaining multiple cards", () => {
    const options = ["Copper", "Silver", "Gold", "Province"];
    const selected = selectCardsToGain(options, 2);

    expect(selected.length).toBe(2);
    // Should gain Province ($8) and Gold ($6)
    expect(selected).toContain("Province");
    expect(selected).toContain("Gold");
  });
});
