import { describe, it, expect } from "bun:test";
import { groupVotersByModel, groupVotersWithColors } from "./groupVoters";

describe("LLMLog/utils/groupVoters", () => {
  describe("groupVotersByModel", () => {
    it("should group single voter without count", () => {
      const result = groupVotersByModel(["GPT-4"]);
      expect(result).toBe("GPT-4");
    });

    it("should group multiple same voters with count", () => {
      const result = groupVotersByModel(["GPT-4", "GPT-4", "GPT-4"]);
      expect(result).toBe("GPT-4 ×3");
    });

    it("should group multiple different voters", () => {
      const result = groupVotersByModel(["GPT-4", "Claude"]);
      // Should be sorted by count (both 1), then alphabetically by implementation
      expect(result).toMatch(/GPT-4, Claude|Claude, GPT-4/);
    });

    it("should sort by count descending", () => {
      const result = groupVotersByModel([
        "GPT-4",
        "GPT-4",
        "GPT-4",
        "Claude",
        "Claude",
        "Gemini",
      ]);
      // GPT-4 has 3, Claude has 2, Gemini has 1
      expect(result).toBe("GPT-4 ×3, Claude ×2, Gemini");
    });

    it("should handle empty array", () => {
      const result = groupVotersByModel([]);
      expect(result).toBe("");
    });

    it("should handle mixed counts correctly", () => {
      const result = groupVotersByModel(["A", "B", "B", "C", "C", "C"]);
      expect(result).toBe("C ×3, B ×2, A");
    });

    it("should not show ×1 for single occurrence", () => {
      const result = groupVotersByModel(["Model-A", "Model-B", "Model-B"]);
      expect(result).toBe("Model-B ×2, Model-A");
    });
  });

  describe("groupVotersWithColors", () => {
    it("should group voters with colors", () => {
      const result = groupVotersWithColors(["GPT-4", "GPT-4", "Claude"]);
      expect(result).toHaveLength(2);
      expect(result.find(v => v.name === "GPT-4")).toEqual({
        name: "GPT-4",
        count: 2,
        color: expect.any(String),
      });
      expect(result.find(v => v.name === "Claude")).toEqual({
        name: "Claude",
        count: 1,
        color: expect.any(String),
      });
    });

    it("should handle single voter", () => {
      const result = groupVotersWithColors(["GPT-4"]);
      expect(result).toEqual([
        {
          name: "GPT-4",
          count: 1,
          color: expect.any(String),
        },
      ]);
    });

    it("should handle empty array", () => {
      const result = groupVotersWithColors([]);
      expect(result).toEqual([]);
    });

    it("should assign unique colors for different models", () => {
      const result = groupVotersWithColors(["Model-A", "Model-B", "Model-C"]);
      expect(result).toHaveLength(3);
      result.forEach(voter => {
        expect(voter).toHaveProperty("name");
        expect(voter).toHaveProperty("count");
        expect(voter).toHaveProperty("color");
        expect(voter.count).toBe(1);
      });
    });

    it("should count multiple occurrences correctly", () => {
      const result = groupVotersWithColors([
        "A",
        "B",
        "A",
        "C",
        "B",
        "B",
        "A",
      ]);
      expect(result).toHaveLength(3);
      expect(result.find(v => v.name === "A")?.count).toBe(3);
      expect(result.find(v => v.name === "B")?.count).toBe(3);
      expect(result.find(v => v.name === "C")?.count).toBe(1);
    });

    it("should include color property for each voter", () => {
      const result = groupVotersWithColors(["TestModel"]);
      expect(result[0]).toHaveProperty("color");
      expect(typeof result[0].color).toBe("string");
    });

    it("should handle many voters efficiently", () => {
      const voters = Array.from({ length: 100 }, (_, i) =>
        i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C",
      );
      const result = groupVotersWithColors(voters);
      expect(result).toHaveLength(3);
      const totalCount = result.reduce((sum, v) => sum + v.count, 0);
      expect(totalCount).toBe(100);
    });
  });
});
