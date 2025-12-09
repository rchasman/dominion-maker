import { describe, it, expect } from "bun:test";
import { getPlayerColor, formatPlayerName } from "./board-utils";

describe("getPlayerColor", () => {
  describe("fixed player colors", () => {
    it("should return blue for 'human'", () => {
      expect(getPlayerColor("human")).toBe("#3b82f6"); // Blue
    });

    it("should return blue for 'player' (converted human)", () => {
      expect(getPlayerColor("player")).toBe("#3b82f6"); // Blue - same as human
    });

    it("should return red for 'ai'", () => {
      expect(getPlayerColor("ai")).toBe("#ef4444"); // Red
    });

    it("should preserve color when human converts to player", () => {
      const humanColor = getPlayerColor("human");
      const playerColor = getPlayerColor("player");
      expect(humanColor).toBe(playerColor);
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

  describe("deterministic colors across mode switches", () => {
    it("should give same color to 'human' and 'player'", () => {
      expect(getPlayerColor("human")).toBe("#3b82f6");
      expect(getPlayerColor("player")).toBe("#3b82f6");
    });

    it("should give consistent colors to AI names", () => {
      const nova1 = getPlayerColor("Nova");
      const nova2 = getPlayerColor("Nova");
      expect(nova1).toBe(nova2);
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
    expect(humanColor).toBe("#3b82f6"); // Blue
    expect(aiColor).toBe("#ef4444"); // Red
    expect(humanColor).not.toBe(aiColor);
  });

  it("should handle converted player in full mode", () => {
    // After switching hybrid→full, human becomes player
    const player = "player";
    const ai = "ai";

    const playerName = formatPlayerName(player, true);
    const aiName = formatPlayerName(ai, true);
    const playerColor = getPlayerColor(player);
    const aiColor = getPlayerColor(ai);

    expect(playerName).toBe("Player (AI)");
    expect(aiName).toBe("ai (AI)");
    expect(playerColor).toBe("#3b82f6"); // Blue - same as "human"
    expect(aiColor).toBe("#ef4444"); // Red
    expect(playerColor).not.toBe(aiColor);
  });

  it("should preserve color when human converts to player", () => {
    // Simulate hybrid mode
    const humanColor = getPlayerColor("human");

    // Simulate switching to full mode (human → player)
    const playerColor = getPlayerColor("player");

    // Should be the same color
    expect(humanColor).toBe(playerColor);
    expect(humanColor).toBe("#3b82f6"); // Blue
  });
});
