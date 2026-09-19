import { describe, it, expect } from "bun:test";
import { getPlayersForMode, GAME_MODE_CONFIG } from "./game-mode";

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
    const calls = Array.from({ length: 5 }).map(() => {
      const players = getPlayersForMode("full");
      return players.join("-");
    });

    // At least some should be different
    const unique = new Set(calls);
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("GAME_MODE_CONFIG.full.isAIPlayer", () => {
  it("should identify 'ai' as AI in full mode", () => {
    const config = GAME_MODE_CONFIG.full;
    expect(config.isAIPlayer("ai")).toBe(true);
  });

  it("should identify 'human' as AI once a hybrid game switches to full", () => {
    const config = GAME_MODE_CONFIG.full;
    expect(config.isAIPlayer("human")).toBe(true);
  });

  it("should identify custom AI names as AI in full mode", () => {
    const config = GAME_MODE_CONFIG.full;
    expect(config.isAIPlayer("Nova")).toBe(true);
    expect(config.isAIPlayer("Alpha")).toBe(true);
    expect(config.isAIPlayer("Nexus")).toBe(true);
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
});
