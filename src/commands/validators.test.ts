import { describe, test, expect } from "bun:test";
import { validators, validateCommand } from "./validators";
import type { GameState } from "../types/game-state";

describe("Validation Middleware", () => {
  const mockState: Partial<GameState> = {
    phase: "action",
    actions: 1,
    buys: 1,
    coins: 5,
    players: {
      p1: {
        hand: ["Village", "Copper"],
        deck: [],
        discard: [],
        inPlay: ["Smithy"],
      },
    },
    supply: {
      Village: 10,
      Copper: 30,
      Gold: 0,
    },
  } as unknown as GameState;

  describe("validators.phase", () => {
    test("should pass when phase matches", () => {
      const result = validators.phase(mockState as GameState, "action");
      expect(result).toBeUndefined();
    });

    test("should fail when phase doesn't match", () => {
      const result = validators.phase(mockState as GameState, "buy");
      expect(result).toEqual({ ok: false, error: "Not in buy phase" });
    });
  });

  describe("validators.hasActions", () => {
    test("should pass when actions available", () => {
      const result = validators.hasActions(mockState as GameState);
      expect(result).toBeUndefined();
    });

    test("should fail when no actions", () => {
      const state = { ...mockState, actions: 0 };
      const result = validators.hasActions(state as GameState);
      expect(result).toEqual({ ok: false, error: "No actions remaining" });
    });
  });

  describe("validators.hasBuys", () => {
    test("should pass when buys available", () => {
      const result = validators.hasBuys(mockState as GameState);
      expect(result).toBeUndefined();
    });

    test("should fail when no buys", () => {
      const state = { ...mockState, buys: 0 };
      const result = validators.hasBuys(state as GameState);
      expect(result).toEqual({ ok: false, error: "No buys remaining" });
    });
  });

  describe("validators.hasCoins", () => {
    test("should pass when enough coins", () => {
      const result = validators.hasCoins(mockState as GameState, 5);
      expect(result).toBeUndefined();
    });

    test("should fail when not enough coins", () => {
      const result = validators.hasCoins(mockState as GameState, 6);
      expect(result).toEqual({ ok: false, error: "Not enough coins" });
    });
  });

  describe("validators.cardInHand", () => {
    test("should pass when card is in hand", () => {
      const result = validators.cardInHand(
        mockState as GameState,
        "p1",
        "Village",
      );
      expect(result).toBeUndefined();
    });

    test("should fail when card is not in hand", () => {
      const result = validators.cardInHand(
        mockState as GameState,
        "p1",
        "Gold",
      );
      expect(result).toEqual({ ok: false, error: "Card not in hand" });
    });

    test("should fail when player doesn't exist", () => {
      const result = validators.cardInHand(
        mockState as GameState,
        "p99",
        "Village",
      );
      expect(result).toEqual({ ok: false, error: "Player not found" });
    });
  });

  describe("validators.cardInPlay", () => {
    test("should pass when card is in play", () => {
      const result = validators.cardInPlay(
        mockState as GameState,
        "p1",
        "Smithy",
      );
      expect(result).toBeUndefined();
    });

    test("should fail when card is not in play", () => {
      const result = validators.cardInPlay(
        mockState as GameState,
        "p1",
        "Gold",
      );
      expect(result).toEqual({ ok: false, error: "Card not in play" });
    });
  });

  describe("validators.cardInSupply", () => {
    test("should pass when card is available", () => {
      const result = validators.cardInSupply(mockState as GameState, "Village");
      expect(result).toBeUndefined();
    });

    test("should fail when card is not available", () => {
      const result = validators.cardInSupply(mockState as GameState, "Gold");
      expect(result).toEqual({
        ok: false,
        error: "Card not available in supply",
      });
    });
  });

  describe("validateCommand", () => {
    test("should return undefined when all validators pass", () => {
      const result = validateCommand(
        () => validators.phase(mockState as GameState, "action"),
        () => validators.hasActions(mockState as GameState),
        () => validators.cardInHand(mockState as GameState, "p1", "Village"),
      );
      expect(result).toBeUndefined();
    });

    test("should return first error when a validator fails", () => {
      const result = validateCommand(
        () => validators.phase(mockState as GameState, "action"), // passes
        () => validators.hasActions({ ...mockState, actions: 0 } as GameState), // fails
        () => validators.cardInHand(mockState as GameState, "p1", "Gold"), // would fail but not reached
      );
      expect(result).toEqual({ ok: false, error: "No actions remaining" });
    });

    test("should short-circuit on first error", () => {
      let thirdValidatorCalled = false;
      const result = validateCommand(
        () => validators.phase(mockState as GameState, "buy"), // fails immediately
        () => {
          thirdValidatorCalled = true;
          return null;
        },
      );
      expect(result).toEqual({ ok: false, error: "Not in buy phase" });
      expect(thirdValidatorCalled).toBe(false);
    });
  });
});
