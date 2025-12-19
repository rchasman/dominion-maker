import { describe, it, expect } from "bun:test";
import { stripReasoning } from "./action";
import type { Action } from "./action";

describe("stripReasoning", () => {
  describe("choose_from_options action", () => {
    it("should remove reasoning field", () => {
      const action: Action = {
        type: "choose_from_options",
        optionIndex: 2,
        reasoning: "This is the best option because...",
      };

      const result = stripReasoning(action);

      expect(result).toEqual({
        type: "choose_from_options",
        optionIndex: 2,
      });
      expect("reasoning" in result).toBe(false);
    });

    it("should handle action without reasoning", () => {
      const action: Action = {
        type: "choose_from_options",
        optionIndex: 0,
      };

      const result = stripReasoning(action);

      expect(result).toEqual({
        type: "choose_from_options",
        optionIndex: 0,
      });
    });
  });

  describe("card-based actions", () => {
    it("should remove reasoning and preserve card", () => {
      const action: Action = {
        type: "play_action",
        card: "Smithy",
        reasoning: "Draw more cards",
      };

      const result = stripReasoning(action);

      expect(result).toEqual({
        type: "play_action",
        card: "Smithy",
      });
      expect("reasoning" in result).toBe(false);
    });

    it("should handle action without reasoning but with card", () => {
      const action: Action = {
        type: "buy_card",
        card: "Province",
      };

      const result = stripReasoning(action);

      expect(result).toEqual({
        type: "buy_card",
        card: "Province",
      });
    });

    it("should preserve null card field but remove reasoning", () => {
      const action: Action = {
        type: "skip_decision",
        card: null,
        reasoning: "Nothing to do",
      };

      const result = stripReasoning(action);

      expect(result).toEqual({
        type: "skip_decision",
        card: null,
      });
      expect("reasoning" in result).toBe(false);
    });

    it("should preserve undefined card field but remove reasoning", () => {
      const action: Action = {
        type: "end_phase",
        card: undefined,
        reasoning: "Moving to next phase",
      };

      const result = stripReasoning(action);

      expect(result).toEqual({
        type: "end_phase",
        card: undefined,
      });
      expect("reasoning" in result).toBe(false);
    });

    it("should handle action without card or reasoning", () => {
      const action: Action = {
        type: "decline_reaction",
      };

      const result = stripReasoning(action);

      expect(result).toEqual({
        type: "decline_reaction",
      });
    });
  });

  describe("all action types", () => {
    const actionTypes = [
      "play_action",
      "play_treasure",
      "buy_card",
      "gain_card",
      "discard_card",
      "trash_card",
      "topdeck_card",
      "skip_decision",
      "end_phase",
      "reveal_reaction",
      "decline_reaction",
    ] as const;

    actionTypes.forEach(type => {
      it(`should handle ${type} with card and reasoning`, () => {
        const action: Action = {
          type,
          card: "Copper",
          reasoning: "Test reasoning",
        };

        const result = stripReasoning(action);

        expect("reasoning" in result).toBe(false);
        expect(result.type).toBe(type);
        expect("card" in result ? result.card : null).toBe("Copper");
      });

      it(`should handle ${type} without card`, () => {
        const action: Action = {
          type,
          reasoning: "Test reasoning",
        };

        const result = stripReasoning(action);

        expect("reasoning" in result).toBe(false);
        expect(result.type).toBe(type);
        // Card field may or may not be present depending on action construction
      });
    });
  });

  describe("normalization behavior", () => {
    it("should produce identical signatures for equivalent actions", () => {
      const action1: Action = {
        type: "play_action",
        card: "Village",
        reasoning: "Different reason 1",
      };

      const action2: Action = {
        type: "play_action",
        card: "Village",
        reasoning: "Different reason 2",
      };

      const result1 = stripReasoning(action1);
      const result2 = stripReasoning(action2);

      expect(result1).toEqual(result2);
      expect(JSON.stringify(result1)).toBe(JSON.stringify(result2));
    });

    it("should treat null and undefined card differently", () => {
      const action1: Action = {
        type: "skip_decision",
        card: null,
      };

      const action2: Action = {
        type: "skip_decision",
        card: undefined,
      };

      const result1 = stripReasoning(action1);
      const result2 = stripReasoning(action2);

      // Both preserve their card field (null or undefined)
      expect(result1).toEqual({ type: "skip_decision", card: null });
      expect(result2).toEqual({ type: "skip_decision", card: undefined });
      // They have the same shape but different values
      expect(result1.type).toBe(result2.type);
    });
  });
});
