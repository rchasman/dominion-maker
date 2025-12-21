import { describe, it, expect } from "bun:test";
import { getPhaseBorderColor, getPhaseBackground } from "./phase-styles";
import type { Phase, TurnSubPhase } from "../../types/game-state";

describe("PlayerArea/phase-styles", () => {
  describe("getPhaseBorderColor", () => {
    it("should return default border color when not active", () => {
      const color = getPhaseBorderColor(false, "action", null);
      expect(color).toBe("var(--color-border)");
    });

    it("should return reaction color for awaiting_reaction subphase", () => {
      const color = getPhaseBorderColor(true, "action", "awaiting_reaction");
      expect(color).toBe("var(--color-reaction)");
    });

    it("should return reaction color for opponent_decision subphase", () => {
      const color = getPhaseBorderColor(true, "buy", "opponent_decision");
      expect(color).toBe("var(--color-reaction)");
    });

    it("should return action phase color for action phase", () => {
      const color = getPhaseBorderColor(true, "action", null);
      expect(color).toBe("var(--color-action-phase)");
    });

    it("should return buy phase color for buy phase", () => {
      const color = getPhaseBorderColor(true, "buy", null);
      expect(color).toBe("var(--color-buy-phase)");
    });

    it("should prioritize subphase color over phase color", () => {
      const color = getPhaseBorderColor(true, "action", "awaiting_reaction");
      expect(color).toBe("var(--color-reaction)");
    });

    it("should return default border when active but unknown phase", () => {
      const color = getPhaseBorderColor(true, "unknown" as Phase, null);
      expect(color).toBe("var(--color-border)");
    });
  });

  describe("getPhaseBackground", () => {
    it("should return inactive gradient when not active", () => {
      const bg = getPhaseBackground(false, "action", null);
      expect(bg).toBe(
        "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
      );
    });

    it("should return reaction gradient for awaiting_reaction subphase", () => {
      const bg = getPhaseBackground(true, "action", "awaiting_reaction");
      expect(bg).toBe("linear-gradient(180deg, #253837 0%, #1a2628 100%)");
    });

    it("should return reaction gradient for opponent_decision subphase", () => {
      const bg = getPhaseBackground(true, "buy", "opponent_decision");
      expect(bg).toBe("linear-gradient(180deg, #253837 0%, #1a2628 100%)");
    });

    it("should return action gradient for action phase", () => {
      const bg = getPhaseBackground(true, "action", null);
      expect(bg).toBe("linear-gradient(180deg, #2d2540 0%, #1e1a2f 100%)");
    });

    it("should return buy gradient for buy phase", () => {
      const bg = getPhaseBackground(true, "buy", null);
      expect(bg).toBe("linear-gradient(180deg, #253532 0%, #1a2428 100%)");
    });

    it("should prioritize subphase background over phase background", () => {
      const bg = getPhaseBackground(true, "buy", "awaiting_reaction");
      expect(bg).toBe("linear-gradient(180deg, #253837 0%, #1a2628 100%)");
    });

    it("should return default gradient for unknown phase when active", () => {
      const bg = getPhaseBackground(true, "unknown" as Phase, null);
      expect(bg).toBe(
        "linear-gradient(180deg, var(--color-bg-tertiary) 0%, var(--color-bg-primary) 100%)",
      );
    });

    it("should return inactive gradient when not active regardless of phase", () => {
      const actionBg = getPhaseBackground(false, "action", null);
      const buyBg = getPhaseBackground(false, "buy", null);
      expect(actionBg).toBe(buyBg);
    });
  });

  describe("edge cases", () => {
    it("should handle null subphase correctly", () => {
      const color = getPhaseBorderColor(true, "action", null);
      const bg = getPhaseBackground(true, "action", null);
      expect(color).toBe("var(--color-action-phase)");
      expect(bg).toBe("linear-gradient(180deg, #2d2540 0%, #1e1a2f 100%)");
    });

    it("should handle undefined subphase like null", () => {
      const color = getPhaseBorderColor(true, "buy", undefined as any);
      const bg = getPhaseBackground(true, "buy", undefined as any);
      expect(color).toBe("var(--color-buy-phase)");
      expect(bg).toBe("linear-gradient(180deg, #253532 0%, #1a2428 100%)");
    });
  });
});
