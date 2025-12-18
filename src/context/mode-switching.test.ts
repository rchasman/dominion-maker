import { describe, it, expect } from "bun:test";
import { DominionEngine } from "../engine/engine";
import { getPlayersForMode } from "../types/game-mode";

describe("Mode switching during active game", () => {
  it("should handle player ID lookup with actual game state players", () => {
    const engine = new DominionEngine();

    // Start in hybrid mode
    engine.startGame(getPlayersForMode("hybrid"));
    expect(engine.state.players).toHaveProperty("human");
    expect(engine.state.players).toHaveProperty("ai");

    // Simulate mode switch: the game state hasn't changed, but mode expectation has
    // Board should use ACTUAL player IDs from state, not expected ones from config
    const actualPlayerIds = Object.keys(engine.state.players);

    expect(actualPlayerIds).toContain("human");
    expect(actualPlayerIds).toContain("ai");
    expect(actualPlayerIds).not.toContain("ai1");
    expect(actualPlayerIds).not.toContain("ai2");

    // Board should be able to access these players
    const mainPlayer = engine.state.players[actualPlayerIds[0]];
    expect(mainPlayer).toBeDefined();
    expect(mainPlayer.deck).toBeDefined();
  });

  it("should preserve game state when switching from hybrid to engine", () => {
    const engine = new DominionEngine();

    engine.startGame(getPlayersForMode("hybrid"));
    const initialPlayers = Object.keys(engine.state.players);

    // Both modes use ["human", "ai"] so switching should be safe
    expect(getPlayersForMode("hybrid")).toEqual(getPlayersForMode("engine"));
    expect(initialPlayers).toEqual(["human", "ai"]);
  });

  it("should detect player ID mismatch when switching to full mode", () => {
    const engine = new DominionEngine();

    // Start in hybrid mode
    engine.startGame(getPlayersForMode("hybrid"));
    const actualPlayers = Object.keys(engine.state.players);

    // Full mode generates dynamic player names
    const fullModePlayers = getPlayersForMode("full");

    // These should NOT match (hybrid has human+ai, full has two AI names)
    expect(actualPlayers).not.toEqual(fullModePlayers);
    expect(actualPlayers).toEqual(["human", "ai"]);
    expect(fullModePlayers).toHaveLength(2);
    expect(fullModePlayers[0]).not.toBe("human");
    expect(fullModePlayers[1]).not.toBe("human");
  });

  it("should handle accessing non-existent player gracefully", () => {
    const engine = new DominionEngine();

    engine.startGame(["human", "ai"]);

    // Try to access ai1 (doesn't exist)
    const ai1 = engine.state.players["ai1"];
    expect(ai1).toBeUndefined();

    // Actual players that exist
    expect(engine.state.players["human"]).toBeDefined();
    expect(engine.state.players["ai"]).toBeDefined();
  });

  it("should use actual player IDs for dynamic lookup", () => {
    const engine = new DominionEngine();

    // Start with full mode players
    engine.startGame(getPlayersForMode("full"));

    // Get actual player IDs from state
    const actualPlayerIds = Object.keys(engine.state.players);

    // Should be able to access all actual players
    actualPlayerIds.forEach(playerId => {
      const player = engine.state.players[playerId]!;
      expect(player).toBeDefined();
      expect(player.deck).toBeDefined();
      expect(player.hand).toBeDefined();
      expect(player.discard).toBeDefined();
      expect(player.inPlay).toBeDefined();
    });
  });

  describe("game restart on mode switch", () => {
    it("should create new game with correct player IDs when switching modes", () => {
      const engine1 = new DominionEngine();
      const engine2 = new DominionEngine();

      // Simulate starting in hybrid then switching to full
      engine1.startGame(getPlayersForMode("hybrid"));
      const hybridPlayers = Object.keys(engine1.state.players);

      // "Switch mode" by starting new game with full mode players
      engine2.startGame(getPlayersForMode("full"));
      const fullPlayers = Object.keys(engine2.state.players);

      expect(hybridPlayers).toEqual(["human", "ai"]);
      expect(fullPlayers).toHaveLength(2);
      expect(fullPlayers[0]).not.toBe("human");
      expect(fullPlayers[1]).not.toBe("human");
    });

    it("should preserve kingdom cards when restarting game", () => {
      const engine = new DominionEngine();

      const kingdomCards = [
        "Village",
        "Smithy",
        "Market",
        "Laboratory",
        "Festival",
        "Militia",
        "Remodel",
        "Mine",
        "Workshop",
        "Cellar",
      ] as const;

      engine.startGame(getPlayersForMode("hybrid"), kingdomCards);
      const initialKingdom = engine.state.kingdomCards;

      // Restart with different players but same kingdom
      const engine2 = new DominionEngine();
      engine2.startGame(getPlayersForMode("full"), kingdomCards);
      const newKingdom = engine2.state.kingdomCards;

      expect(initialKingdom).toEqual(newKingdom);
    });

    it("should reset game state when restarting", () => {
      const engine = new DominionEngine();

      engine.startGame(["human", "ai"]);

      // Play a few turns
      if (engine.state.phase === "action") engine.endPhase("human");
      if (engine.state.phase === "buy") engine.endPhase("human");
      if (engine.state.phase === "action") engine.endPhase("ai");
      if (engine.state.phase === "buy") engine.endPhase("ai");

      const turnCount = engine.state.turn;
      expect(turnCount).toBeGreaterThan(1);

      // Restart
      engine.startGame(["ai1", "ai2"]);

      // Should be back to turn 1
      expect(engine.state.turn).toBe(1);
    });
  });

  describe("safe mode switching", () => {
    it("should allow switching between engine and hybrid mid-game", () => {
      const engine = new DominionEngine();

      engine.startGame(getPlayersForMode("engine"));
      expect(Object.keys(engine.state.players)).toEqual(["human", "ai"]);

      // Both modes use same player IDs, so switching is safe
      const playersBefore = Object.keys(engine.state.players);

      // Simulate mode switch (same players)
      const engineMode = getPlayersForMode("engine");
      const hybridMode = getPlayersForMode("hybrid");

      expect(engineMode).toEqual(hybridMode);
      expect(playersBefore).toEqual(engineMode);
      expect(playersBefore).toEqual(hybridMode);
    });

    it("should identify when mode switch requires restart", () => {
      const needsRestart = (
        currentPlayers: string[],
        targetMode: "engine" | "hybrid" | "full",
      ) => {
        const targetPlayers = getPlayersForMode(targetMode);
        return JSON.stringify(currentPlayers) !== JSON.stringify(targetPlayers);
      };

      // engine → full requires restart (full generates dynamic names)
      expect(needsRestart(["human", "ai"], "full")).toBe(true);

      // hybrid → full requires restart
      expect(needsRestart(["human", "ai"], "full")).toBe(true);

      // engine → hybrid does NOT require restart
      expect(needsRestart(["human", "ai"], "hybrid")).toBe(false);
      expect(needsRestart(["human", "ai"], "engine")).toBe(false);

      // full → hybrid requires restart (full has different player IDs)
      const fullPlayers = getPlayersForMode("full");
      expect(needsRestart(fullPlayers, "hybrid")).toBe(true);

      // full → engine requires restart
      expect(needsRestart(fullPlayers, "engine")).toBe(true);
    });
  });
});
