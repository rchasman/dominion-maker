import { describe, it, expect } from "bun:test";
import { getPlayerColor, formatPlayerName } from "./board-utils";

describe("getPlayerColor", () => {
  describe("legacy player colors", () => {
    it("should return predefined color for 'human'", () => {
      expect(getPlayerColor("human")).toBe("var(--color-human)");
    });

    it("should return predefined color for 'ai'", () => {
      expect(getPlayerColor("ai")).toBe("var(--color-ai)");
    });

    it("should return predefined colors for player0-4", () => {
      expect(getPlayerColor("player0")).toBe("var(--color-human)");
      expect(getPlayerColor("player1")).toBe("var(--color-ai)");
      expect(getPlayerColor("player2")).toBe("var(--color-player-3)");
      expect(getPlayerColor("player3")).toBe("var(--color-player-4)");
      expect(getPlayerColor("player4")).toBe("var(--color-player-5)");
    });
  });

  describe("dynamic player colors", () => {
    it("should return hex color for custom player names", () => {
      const color = getPlayerColor("Nova");
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("should return consistent color for same player", () => {
      expect(getPlayerColor("Alpha")).toBe(getPlayerColor("Alpha"));
      expect(getPlayerColor("Nova")).toBe(getPlayerColor("Nova"));
      expect(getPlayerColor("player")).toBe(getPlayerColor("player"));
    });

    it("should return different colors for different players", () => {
      const colors = [
        getPlayerColor("Alpha"),
        getPlayerColor("Beta"),
        getPlayerColor("Gamma"),
        getPlayerColor("Delta"),
      ];

      // At least some should be different
      const unique = new Set(colors);
      expect(unique.size).toBeGreaterThan(1);
    });

    it("should handle special characters in player names", () => {
      expect(() => getPlayerColor("player-123")).not.toThrow();
      expect(() => getPlayerColor("AI_Nova")).not.toThrow();
      expect(() => getPlayerColor("test.player")).not.toThrow();
    });

    it("should return color for empty string", () => {
      const color = getPlayerColor("");
      expect(color).toBeTruthy();
    });
  });

  describe("color consistency", () => {
    it("should use deterministic hash for same name", () => {
      const calls: string[] = [];

      for (let i = 0; i < 10; i++) {
        calls.push(getPlayerColor("TestPlayer"));
      }

      // All should be identical
      expect(new Set(calls).size).toBe(1);
    });

    it("should distribute names across color palette", () => {
      const names = Array.from({ length: 50 }, (_, i) => `Player${i}`);
      const colors = names.map(getPlayerColor);
      const uniqueColors = new Set(colors);

      // Should use multiple different colors from the palette
      expect(uniqueColors.size).toBeGreaterThan(3);
    });
  });
});

describe("formatPlayerName", () => {
  describe("special player IDs", () => {
    it("should format 'human' as 'You'", () => {
      expect(formatPlayerName("human", false)).toBe("You");
    });

    it("should format 'player' as 'Player'", () => {
      expect(formatPlayerName("player", false)).toBe("Player");
    });

    it("should format 'player' as 'player' when capitalize=false", () => {
      expect(formatPlayerName("player", false, { capitalize: false })).toBe(
        "player",
      );
    });

    it("should keep custom names as-is", () => {
      expect(formatPlayerName("Nova", false)).toBe("Nova");
      expect(formatPlayerName("Alpha", false)).toBe("Alpha");
      expect(formatPlayerName("Cipher", false)).toBe("Cipher");
    });
  });

  describe("AI suffix", () => {
    it("should add (AI) suffix for AI players", () => {
      expect(formatPlayerName("ai", true)).toBe("ai (AI)");
      expect(formatPlayerName("Nova", true)).toBe("Nova (AI)");
      expect(formatPlayerName("player", true)).toBe("Player (AI)");
    });

    it("should NOT add (AI) suffix for human player", () => {
      expect(formatPlayerName("human", true)).toBe("You");
      expect(formatPlayerName("human", false)).toBe("You");
    });

    it("should NOT add (AI) suffix when isAI=false", () => {
      expect(formatPlayerName("ai", false)).toBe("ai");
      expect(formatPlayerName("Nova", false)).toBe("Nova");
      expect(formatPlayerName("player", false)).toBe("Player");
    });
  });

  describe("AI suffix with special IDs", () => {
    it("should show 'Player (AI)' for converted human in full mode", () => {
      expect(formatPlayerName("player", true)).toBe("Player (AI)");
    });

    it("should show 'ai (AI)' for standard AI", () => {
      expect(formatPlayerName("ai", true)).toBe("ai (AI)");
    });

    it("should show cool names with AI suffix", () => {
      expect(formatPlayerName("Nova", true)).toBe("Nova (AI)");
      expect(formatPlayerName("Alpha", true)).toBe("Alpha (AI)");
      expect(formatPlayerName("Nexus", true)).toBe("Nexus (AI)");
      expect(formatPlayerName("Cipher", true)).toBe("Cipher (AI)");
    });
  });

  describe("capitalization", () => {
    it("should capitalize 'player' by default", () => {
      expect(formatPlayerName("player", false)).toBe("Player");
    });

    it("should keep lowercase when capitalize=false", () => {
      expect(formatPlayerName("player", false, { capitalize: false })).toBe(
        "player",
      );
    });

    it("should not affect other player names", () => {
      expect(formatPlayerName("Nova", false, { capitalize: false })).toBe(
        "Nova",
      );
      expect(formatPlayerName("human", false, { capitalize: false })).toBe(
        "You",
      );
    });
  });

  describe("combined scenarios", () => {
    it("should handle all combinations correctly", () => {
      // Human player
      expect(formatPlayerName("human", false)).toBe("You");
      expect(formatPlayerName("human", true)).toBe("You");

      // Standard AI
      expect(formatPlayerName("ai", false)).toBe("ai");
      expect(formatPlayerName("ai", true)).toBe("ai (AI)");

      // Converted human (player) as AI in full mode
      expect(formatPlayerName("player", true)).toBe("Player (AI)");

      // Cool AI names
      expect(formatPlayerName("Nova", true)).toBe("Nova (AI)");
      expect(formatPlayerName("Alpha", true)).toBe("Alpha (AI)");
    });
  });
});

describe("Player display integration", () => {
  it("should provide both color and formatted name for any player", () => {
    const playerIds = ["human", "ai", "player", "Nova", "Alpha", "Cipher"];

    playerIds.forEach(playerId => {
      const color = getPlayerColor(playerId);
      const name = formatPlayerName(playerId, true);

      expect(color).toBeTruthy();
      expect(name).toBeTruthy();
      expect(typeof color).toBe("string");
      expect(typeof name).toBe("string");
    });
  });

  it("should handle full mode AI vs AI scenario", () => {
    // Both players are AI
    const player1 = "Nova";
    const player2 = "Cipher";

    const name1 = formatPlayerName(player1, true);
    const name2 = formatPlayerName(player2, true);
    const color1 = getPlayerColor(player1);
    const color2 = getPlayerColor(player2);

    expect(name1).toBe("Nova (AI)");
    expect(name2).toBe("Cipher (AI)");
    expect(color1).not.toBe(color2); // Different colors
  });

  it("should handle hybrid mode human vs AI scenario", () => {
    const human = "human";
    const ai = "ai";

    const humanName = formatPlayerName(human, false);
    const aiName = formatPlayerName(ai, true);
    const humanColor = getPlayerColor(human);
    const aiColor = getPlayerColor(ai);

    expect(humanName).toBe("You");
    expect(aiName).toBe("ai (AI)");
    expect(humanColor).toBe("var(--color-human)");
    expect(aiColor).toBe("var(--color-ai)");
  });

  it("should handle converted player in full mode", () => {
    // After switching hybrid→full, human becomes player
    const player = "player";
    const ai = "ai";

    const playerName = formatPlayerName(player, true);
    const aiName = formatPlayerName(ai, true);

    expect(playerName).toBe("Player (AI)");
    expect(aiName).toBe("ai (AI)");
  });
});
