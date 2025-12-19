import { describe, it, expect, beforeEach } from "bun:test";
import { shuffle, drawCards, countVP } from "./game-utils";
import type { PlayerState, CardName } from "../types/game-state";

describe("game-utils", () => {
  describe("shuffle", () => {
    it("returns array with same length", () => {
      const input = [1, 2, 3, 4, 5];
      const result = shuffle(input);
      expect(result.length).toBe(input.length);
    });

    it("returns array with same elements", () => {
      const input = [1, 2, 3, 4, 5];
      const result = shuffle(input);
      expect(result.sort()).toEqual(input.sort());
    });

    it("does not mutate original array", () => {
      const input = [1, 2, 3, 4, 5];
      const inputCopy = [...input];
      shuffle(input);
      expect(input).toEqual(inputCopy);
    });

    it("handles empty array", () => {
      const result = shuffle([]);
      expect(result).toEqual([]);
    });

    it("handles single element array", () => {
      const result = shuffle([1]);
      expect(result).toEqual([1]);
    });

    it("produces different orderings", () => {
      const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const results = Array.from({ length: 10 }, () =>
        shuffle(input).join(","),
      );
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });
  });

  describe("drawCards", () => {
    let basePlayer: PlayerState;

    beforeEach(() => {
      basePlayer = {
        deck: ["Copper", "Silver", "Gold"],
        hand: ["Estate"],
        discard: ["Duchy"],
        inPlay: [],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
    });

    it("draws cards from deck to hand", () => {
      const result = drawCards(basePlayer, 2);
      expect(result.player.hand.length).toBe(3);
      expect(result.player.deck.length).toBe(1);
      expect(result.drawn.length).toBe(2);
    });

    it("sets deckTopRevealed to false", () => {
      const playerWithReveal = {
        ...basePlayer,
        deckTopRevealed: true,
      };
      const result = drawCards(playerWithReveal, 1);
      expect(result.player.deckTopRevealed).toBe(false);
    });

    it("preserves original player state", () => {
      const originalDeck = [...basePlayer.deck];
      drawCards(basePlayer, 1);
      expect(basePlayer.deck).toEqual(originalDeck);
    });

    it("returns drawn cards in order", () => {
      const result = drawCards(basePlayer, 2);
      expect(result.drawn).toEqual(["Copper", "Silver"]);
    });

    it("creates draw event for cards drawn", () => {
      const result = drawCards(basePlayer, 2);
      expect(result.events.length).toBe(1);
      expect(result.events[0]?.type).toBe("draw");
      expect((result.events[0] as any).cards).toEqual(["Copper", "Silver"]);
    });

    it("shuffles discard into deck when deck is empty", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: [],
        discard: ["Copper", "Silver", "Gold"],
      };
      const result = drawCards(player, 2);
      const totalCards = result.player.deck.length + result.drawn.length;
      expect(totalCards).toBe(3);
      expect(result.player.discard.length).toBe(0);
      expect(result.drawn.length).toBeGreaterThanOrEqual(1);
    });

    it("creates shuffle event when deck runs out", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: ["Copper"],
        discard: ["Silver", "Gold"],
      };
      const result = drawCards(player, 2);
      const shuffleEvent = result.events.find((e) => e.type === "shuffle");
      expect(shuffleEvent).toBeDefined();
    });

    it("creates multiple draw events when shuffling mid-draw", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: ["Copper"],
        discard: ["Silver", "Gold"],
      };
      const result = drawCards(player, 2);
      const drawEvents = result.events.filter((e) => e.type === "draw");
      expect(drawEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("handles drawing when both deck and discard are empty", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: [],
        discard: [],
      };
      const result = drawCards(player, 3);
      expect(result.drawn.length).toBe(0);
      expect(result.player.hand.length).toBe(1);
    });

    it("handles drawing more cards than available", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: ["Copper"],
        discard: ["Silver"],
      };
      const result = drawCards(player, 5);
      expect(result.drawn.length).toBe(2);
    });

    it("handles drawing zero cards", () => {
      const result = drawCards(basePlayer, 0);
      expect(result.drawn.length).toBe(0);
      expect(result.player.hand).toEqual(basePlayer.hand);
      expect(result.events.length).toBe(0);
    });

    it("batches consecutive draws from same pile", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: ["Copper", "Silver", "Gold"],
      };
      const result = drawCards(player, 3);
      expect(result.events.length).toBe(1);
      expect(result.events[0]?.type).toBe("draw");
      expect((result.events[0] as any).cards.length).toBe(3);
    });

    it("creates separate draw events before and after shuffle", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: ["Copper"],
        discard: ["Silver", "Gold", "Estate"],
      };
      const result = drawCards(player, 3);
      const drawEventsBefore = result.events.filter(
        (e, i) => e.type === "draw" && i < result.events.findIndex((e) => e.type === "shuffle"),
      );
      const drawEventsAfter = result.events.filter(
        (e, i) => e.type === "draw" && i > result.events.findIndex((e) => e.type === "shuffle"),
      );
      expect(drawEventsBefore.length).toBe(1);
      expect(drawEventsAfter.length).toBe(1);
    });

    it("handles edge case of shuffling with empty discard", () => {
      const player: PlayerState = {
        ...basePlayer,
        deck: [],
        discard: [],
      };
      const result = drawCards(player, 1);
      expect(result.drawn.length).toBe(0);
      expect(result.events.length).toBe(0);
    });
  });

  describe("countVP", () => {
    it("counts VP from victory cards", () => {
      const player: PlayerState = {
        deck: ["Estate", "Duchy", "Province"],
        hand: [],
        discard: [],
        inPlay: [],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
      const vp = countVP(player);
      expect(vp).toBe(1 + 3 + 6);
    });

    it("counts VP from Gardens based on deck size", () => {
      const player: PlayerState = {
        deck: Array(20).fill("Copper") as CardName[],
        hand: [],
        discard: [],
        inPlay: ["Gardens"],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
      const vp = countVP(player);
      expect(vp).toBe(2);
    });

    it("counts VP from multiple Gardens", () => {
      const player: PlayerState = {
        deck: Array(20).fill("Copper") as CardName[],
        hand: ["Gardens"],
        discard: [],
        inPlay: ["Gardens"],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
      const vp = countVP(player);
      expect(vp).toBe(4);
    });

    it("handles player with zero VP", () => {
      const player: PlayerState = {
        deck: ["Copper", "Silver", "Gold"],
        hand: [],
        discard: [],
        inPlay: [],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
      const vp = countVP(player);
      expect(vp).toBe(0);
    });

    it("counts VP from all card zones", () => {
      const player: PlayerState = {
        deck: ["Estate"],
        hand: ["Duchy"],
        discard: ["Province"],
        inPlay: ["Estate"],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
      const vp = countVP(player);
      expect(vp).toBe(1 + 3 + 6 + 1);
    });

    it("handles Curse cards (negative VP)", () => {
      const player: PlayerState = {
        deck: ["Curse", "Curse"],
        hand: ["Estate"],
        discard: [],
        inPlay: [],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
      const vp = countVP(player);
      expect(vp).toBe(1 - 2);
    });

    it("Gardens rounds down for partial tens", () => {
      const player: PlayerState = {
        deck: Array(15).fill("Copper") as CardName[],
        hand: [],
        discard: [],
        inPlay: ["Gardens"],
        actions: 1,
        buys: 1,
        coins: 0,
        deckTopRevealed: false,
      };
      const vp = countVP(player);
      expect(vp).toBe(1);
    });
  });
});
