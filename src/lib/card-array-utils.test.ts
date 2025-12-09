import { describe, it, expect } from "bun:test";
import { removeCards, removeCard } from "./card-array-utils";

describe("removeCards - handling duplicates", () => {
  it("should remove exact count of duplicate cards", () => {
    const hand = ["Estate", "Estate", "Estate", "Copper"];
    const result = removeCards(hand, ["Estate", "Estate"]);

    expect(result).toEqual(["Estate", "Copper"]);
  });

  it("should remove all copies when all specified", () => {
    const hand = ["Estate", "Estate", "Copper"];
    const result = removeCards(hand, ["Estate", "Estate"]);

    expect(result).toEqual(["Copper"]);
  });

  it("should handle mixed card types", () => {
    const hand = ["Estate", "Copper", "Copper", "Silver"];
    const result = removeCards(hand, ["Estate", "Copper", "Copper"]);

    expect(result).toEqual(["Silver"]);
  });

  it("should preserve order of remaining cards", () => {
    const hand = ["Gold", "Estate", "Silver", "Estate", "Copper"];
    const result = removeCards(hand, ["Estate", "Estate"]);

    expect(result).toEqual(["Gold", "Silver", "Copper"]);
  });

  it("should handle empty removal array", () => {
    const hand = ["Estate", "Copper"];
    const result = removeCards(hand, []);

    expect(result).toEqual(["Estate", "Copper"]);
  });

  it("should handle removing cards not in array", () => {
    const hand = ["Estate", "Copper"];
    const result = removeCards(hand, ["Gold", "Silver"]);

    expect(result).toEqual(["Estate", "Copper"]);
  });

  it("should not mutate original array", () => {
    const hand = ["Estate", "Copper"];
    const original = [...hand];
    removeCards(hand, ["Estate"]);

    expect(hand).toEqual(original);
  });
});

describe("removeCard - single card removal", () => {
  it("should remove first occurrence by default", () => {
    const hand = ["Estate", "Estate", "Copper"];
    const result = removeCard(hand, "Estate");

    expect(result).toEqual(["Estate", "Copper"]);
  });

  it("should remove from end when fromEnd=true", () => {
    const deck = ["Estate", "Silver", "Estate"];
    const result = removeCard(deck, "Estate", true);

    expect(result).toEqual(["Estate", "Silver"]);
  });

  it("should handle card not in array", () => {
    const hand = ["Estate", "Copper"];
    const result = removeCard(hand, "Gold");

    expect(result).toEqual(["Estate", "Copper"]);
  });

  it("should not mutate original array", () => {
    const hand = ["Estate", "Copper"];
    const original = [...hand];
    removeCard(hand, "Estate");

    expect(hand).toEqual(original);
  });
});
