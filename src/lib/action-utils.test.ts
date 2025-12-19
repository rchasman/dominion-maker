import { describe, it, expect } from "bun:test";
import { hasCardField, formatActionDescription } from "./action-utils";
import type { Action } from "../types/action";

describe("action-utils", () => {
  describe("hasCardField", () => {
    it("returns true for play_action with card field", () => {
      const action: Action = { type: "play_action", card: "Village" };
      expect(hasCardField(action)).toBe(true);
    });

    it("returns true for play_treasure with card field", () => {
      const action: Action = { type: "play_treasure", card: "Copper" };
      expect(hasCardField(action)).toBe(true);
    });

    it("returns true for buy_card with card field", () => {
      const action: Action = { type: "buy_card", card: "Estate" };
      expect(hasCardField(action)).toBe(true);
    });

    it("returns false for end_phase", () => {
      const action: Action = { type: "end_phase" };
      expect(hasCardField(action)).toBe(false);
    });

    it("returns false for skip_decision", () => {
      const action: Action = { type: "skip_decision" };
      expect(hasCardField(action)).toBe(false);
    });

    it("returns false for choose_from_options", () => {
      const action: Action = { type: "choose_from_options", optionIndex: 0 };
      expect(hasCardField(action)).toBe(false);
    });

    it("returns true for gain_card with card field", () => {
      const action: Action = { type: "gain_card", card: "Silver" };
      expect(hasCardField(action)).toBe(true);
    });

    it("returns true for play_action even with null card (field exists)", () => {
      const action: Action = { type: "play_action", card: null };
      expect(hasCardField(action)).toBe(true);
    });

    it("narrows type correctly for actions with card field", () => {
      const action: Action = { type: "play_action", card: "Village" };
      if (hasCardField(action)) {
        expect(action.card).toBe("Village");
      }
    });
  });

  describe("formatActionDescription", () => {
    it("formats action with card field", () => {
      const action: Action = { type: "play_action", card: "Village" };
      expect(formatActionDescription(action)).toBe("play_action(Village)");
    });

    it("formats action without card field", () => {
      const action: Action = { type: "end_phase" };
      expect(formatActionDescription(action)).toBe("end_phase");
    });

    it("formats buy_card action", () => {
      const action: Action = { type: "buy_card", card: "Estate" };
      expect(formatActionDescription(action)).toBe("buy_card(Estate)");
    });

    it("formats skip_decision action", () => {
      const action: Action = { type: "skip_decision" };
      expect(formatActionDescription(action)).toBe("skip_decision");
    });

    it("formats choose_from_options action", () => {
      const action: Action = { type: "choose_from_options", optionIndex: 0 };
      expect(formatActionDescription(action)).toBe("choose_from_options");
    });

    it("formats gain_card action", () => {
      const action: Action = { type: "gain_card", card: "Silver" };
      expect(formatActionDescription(action)).toBe("gain_card(Silver)");
    });
  });
});
