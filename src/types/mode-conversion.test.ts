import { describe, it, expect } from "bun:test";
import {
  getPlayersForMode,
  convertToFullModePlayers,
  GAME_MODE_CONFIG,
} from "./game-mode";

describe("getPlayersForMode", () => {
  it("should return static players for engine mode", () => {
    const players = getPlayersForMode("engine");
    expect(players).toEqual(["human", "ai"]);
  });

  it("should return static players for hybrid mode", () => {
    const players = getPlayersForMode("hybrid");
    expect(players).toEqual(["human", "ai"]);
  });

  it("should generate dynamic players for full mode", () => {
    const players1 = getPlayersForMode("full");
    const players2 = getPlayersForMode("full");

    // Should have 2 players
    expect(players1).toHaveLength(2);
    expect(players2).toHaveLength(2);

    // Players should be unique within each call
    expect(players1[0]).not.toBe(players1[1]);
    expect(players2[0]).not.toBe(players2[1]);

    // Should not be "human" or "ai"
    expect(players1).not.toContain("human");
    expect(players1).not.toContain("ai");
    expect(players2).not.toContain("human");
    expect(players2).not.toContain("ai");
  });

  it("should generate different names on each full mode call", () => {
    const calls: string[] = [];

    for (let i = 0; i < 5; i++) {
      const players = getPlayersForMode("full");
      calls.push(players.join("-"));
    }

    // At least some should be different
    const unique = new Set(calls);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("convertToFullModePlayers", () => {
  describe("preserving player names from hybrid mode", () => {
    it("should convert 'human' to 'player'", () => {
      const existing = ["human", "ai"];
      const converted = convertToFullModePlayers(existing);

      expect(converted).toContain("player");
      expect(converted).not.toContain("human");
    });

    it("should keep 'ai' as is", () => {
      const existing = ["human", "ai"];
      const converted = convertToFullModePlayers(existing);

      expect(converted).toContain("ai");
      expect(converted).toEqual(["player", "ai"]);
    });

    it("should preserve order", () => {
      const existing = ["human", "ai"];
      const converted = convertToFullModePlayers(existing);

      expect(converted[0]).toBe("player"); // human was first
      expect(converted[1]).toBe("ai"); // ai was second
    });
  });

  describe("with custom player names", () => {
    it("should keep custom AI names unchanged", () => {
      const existing = ["human", "Nova"];
      const converted = convertToFullModePlayers(existing);

      expect(converted).toEqual(["player", "Nova"]);
    });

    it("should convert human but keep other player", () => {
      const existing = ["human", "Nexus"];
      const converted = convertToFullModePlayers(existing);

      expect(converted[0]).toBe("player");
      expect(converted[1]).toBe("Nexus");
    });

    it("should handle reversed order", () => {
      const existing = ["ai", "human"];
      const converted = convertToFullModePlayers(existing);

      expect(converted[0]).toBe("ai");
      expect(converted[1]).toBe("player");
    });

    it("should keep two AI names unchanged", () => {
      const existing = ["Alpha", "Beta"];
      const converted = convertToFullModePlayers(existing);

      expect(converted).toEqual(["Alpha", "Beta"]);
    });
  });

  describe("edge cases", () => {
    it("should generate new names if not exactly 2 players", () => {
      const converted1 = convertToFullModePlayers(["human"]);
      const converted3 = convertToFullModePlayers(["p1", "p2", "p3"]);

      expect(converted1).toHaveLength(2);
      expect(converted3).toHaveLength(2);

      // Should not contain the original invalid player configs
      expect(converted1).not.toEqual(["human"]);
      expect(converted3).not.toEqual(["p1", "p2", "p3"]);
    });

    it("should generate new names for empty array", () => {
      const converted = convertToFullModePlayers([]);
      expect(converted).toHaveLength(2);
    });

    it("should generate unique names when regenerating", () => {
      const converted = convertToFullModePlayers(["only-one"]);
      expect(converted[0]).not.toBe(converted[1]);
    });
  });

  describe("isAIPlayer predicate with converted players", () => {
    it("should identify 'player' as AI in full mode", () => {
      const converted = convertToFullModePlayers(["human", "ai"]);
      const config = GAME_MODE_CONFIG.full;

      converted.forEach(playerId => {
        expect(config.isAIPlayer(playerId)).toBe(true);
      });
    });

    it("should identify 'ai' as AI in full mode", () => {
      const config = GAME_MODE_CONFIG.full;
      expect(config.isAIPlayer("ai")).toBe(true);
    });

    it("should identify 'player' as AI in full mode", () => {
      const config = GAME_MODE_CONFIG.full;
      expect(config.isAIPlayer("player")).toBe(true); // player is converted human, treated as AI
    });

    it("should identify custom AI names as AI in full mode", () => {
      const config = GAME_MODE_CONFIG.full;
      expect(config.isAIPlayer("Nova")).toBe(true);
      expect(config.isAIPlayer("Alpha")).toBe(true);
      expect(config.isAIPlayer("Nexus")).toBe(true);
    });
  });
});

describe("Full mode player generation scenarios", () => {
  it("should generate new random names for new full mode game", () => {
    const players = getPlayersForMode("full");

    expect(players).toHaveLength(2);
    expect(players[0]).not.toBe("human");
    expect(players[0]).not.toBe("ai");
    expect(players[1]).not.toBe("human");
    expect(players[1]).not.toBe("ai");
  });

  it("should preserve players when switching from hybrid to full", () => {
    const hybridPlayers = ["human", "ai"];
    const converted = convertToFullModePlayers(hybridPlayers);

    // human becomes player, ai stays ai
    expect(converted).toEqual(["player", "ai"]);
  });

  it("should preserve players when switching from engine to full", () => {
    const enginePlayers = ["human", "ai"];
    const converted = convertToFullModePlayers(enginePlayers);

    // Same as hybrid
    expect(converted).toEqual(["player", "ai"]);
  });

  it("should handle multiple conversions idempotently", () => {
    const original = ["human", "ai"];
    const converted1 = convertToFullModePlayers(original);
    const converted2 = convertToFullModePlayers(converted1);

    // Second conversion should not change anything
    expect(converted2).toEqual(converted1);
    expect(converted2).toEqual(["player", "ai"]);
  });
});
