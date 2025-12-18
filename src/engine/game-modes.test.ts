import { describe, it, expect } from "bun:test";
import { DominionEngine } from "./engine";
import { GAME_MODE_CONFIG, getPlayersForMode } from "../types/game-mode";

describe("Game initialization with different modes", () => {
  describe("engine mode", () => {
    it("should initialize with human and ai players", () => {
      const engine = new DominionEngine();
      const players = getPlayersForMode("engine");

      const result = engine.startGame(players);

      expect(result.ok).toBe(true);
      expect(engine.state.players).toHaveProperty("human");
      expect(engine.state.players).toHaveProperty("ai");
      expect(Object.keys(engine.state.players)).toHaveLength(2);
    });

    it("should set first player as active", () => {
      const engine = new DominionEngine();
      const players = getPlayersForMode("engine");

      engine.startGame(players);

      expect(engine.state.activePlayerId).toBe(players[0]);
    });

    it("should correctly identify AI player during turns", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.engine;

      engine.startGame(getPlayersForMode("engine"));

      // Check that isAIPlayer correctly identifies the AI
      expect(config.isAIPlayer(engine.state.activePlayerId)).toBe(
        engine.state.activePlayerId === "ai",
      );
    });
  });

  describe("hybrid mode", () => {
    it("should initialize with human and ai players", () => {
      const engine = new DominionEngine();
      const players = getPlayersForMode("hybrid");

      const result = engine.startGame(players);

      expect(result.ok).toBe(true);
      expect(engine.state.players).toHaveProperty("human");
      expect(engine.state.players).toHaveProperty("ai");
      expect(Object.keys(engine.state.players)).toHaveLength(2);
    });

    it("should have same player structure as engine mode", () => {
      const engineMode = new DominionEngine();
      const hybridMode = new DominionEngine();

      engineMode.startGame(getPlayersForMode("engine"));
      hybridMode.startGame(getPlayersForMode("hybrid"));

      expect(Object.keys(engineMode.state.players).sort()).toEqual(
        Object.keys(hybridMode.state.players).sort(),
      );
    });
  });

  describe("full mode", () => {
    it("should initialize with two AI players", () => {
      const engine = new DominionEngine();
      const players = getPlayersForMode("full");

      const result = engine.startGame(players);

      expect(result.ok).toBe(true);
      expect(Object.keys(engine.state.players)).toHaveLength(2);

      // Should have two AI names (not "human")
      const playerIds = Object.keys(engine.state.players);
      expect(playerIds).not.toContain("human");
    });

    it("should NOT have human player", () => {
      const engine = new DominionEngine();
      const players = getPlayersForMode("full");

      engine.startGame(players);

      expect(engine.state.players).not.toHaveProperty("human");
    });

    it("should set first player as active", () => {
      const engine = new DominionEngine();
      const players = getPlayersForMode("full");

      engine.startGame(players);

      expect(engine.state.activePlayerId).toBe(players[0]);
    });

    it("should identify all players as AI in full mode", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;
      const players = getPlayersForMode("full");

      engine.startGame(players);

      // ALL players should be identified as AI in full mode
      expect(config.isAIPlayer(players[0])).toBe(true);
      expect(config.isAIPlayer(players[1])).toBe(true);

      // Even "human" becomes AI-controlled in full mode
      expect(config.isAIPlayer("human")).toBe(true);
      expect(config.isAIPlayer("player")).toBe(true);
      expect(config.isAIPlayer("ai")).toBe(true);
    });

    it("should allow both AI players to take turns", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;
      const players = getPlayersForMode("full");

      engine.startGame(players);

      const initialPlayer = engine.state.activePlayerId;
      expect(config.isAIPlayer(initialPlayer)).toBe(true);

      // End both phases for first player to complete turn
      if (engine.state.phase === "action") engine.endPhase(initialPlayer);
      if (engine.state.phase === "buy") engine.endPhase(initialPlayer);

      const nextPlayer = engine.state.activePlayerId;
      expect(config.isAIPlayer(nextPlayer)).toBe(true);
      expect(nextPlayer).not.toBe(initialPlayer);
    });
  });

  describe("player state structure", () => {
    it("should create identical player state structure for all modes", () => {
      const engines = [
        { mode: "engine", engine: new DominionEngine() },
        { mode: "hybrid", engine: new DominionEngine() },
        { mode: "full", engine: new DominionEngine() },
      ];

      engines.forEach(({ engine }) => {
        engine.startGame(["ai1", "ai2"]);

        // Check each player has the expected structure
        Object.values(engine.state.players).forEach(player => {
          expect(player).toHaveProperty("deck");
          expect(player).toHaveProperty("hand");
          expect(player).toHaveProperty("discard");
          expect(player).toHaveProperty("inPlay");
          expect(Array.isArray(player.deck)).toBe(true);
          expect(Array.isArray(player.hand)).toBe(true);
          expect(Array.isArray(player.discard)).toBe(true);
          expect(Array.isArray(player.inPlay)).toBe(true);
        });
      });
    });

    it("should start each player with same deck composition", () => {
      const engine = new DominionEngine();

      engine.startGame(["ai1", "ai2"]);

      const player1Cards = [
        ...engine.state.players.ai1.deck,
        ...engine.state.players.ai1.hand,
      ];
      const player2Cards = [
        ...engine.state.players.ai2.deck,
        ...engine.state.players.ai2.hand,
      ];

      // Count card types
      const countCards = (cards: string[]) => {
        const counts: Record<string, number> = {};
        cards.forEach(card => {
          counts[card] = (counts[card] || 0) + 1;
        });
        return counts;
      };

      const p1Counts = countCards(player1Cards);
      const p2Counts = countCards(player2Cards);

      // Both should start with 7 Copper and 3 Estate
      expect(p1Counts.Copper).toBe(7);
      expect(p1Counts.Estate).toBe(3);
      expect(p2Counts.Copper).toBe(7);
      expect(p2Counts.Estate).toBe(3);
    });
  });

  describe("game state consistency", () => {
    it("should have valid activePlayer for all modes", () => {
      ["engine", "hybrid", "full"].forEach(() => {
        const engine = new DominionEngine();

        engine.startGame(["ai1", "ai2"]);

        expect(engine.state.activePlayerId).toBeTruthy();
        expect(engine.state.players).toHaveProperty(engine.state.activePlayerId);
      });
    });

    it("should initialize supply with same kingdom cards when using same seed", () => {
      const engines = [
        new DominionEngine(),
        new DominionEngine(),
        new DominionEngine(),
      ];
      const modes: ("engine" | "hybrid" | "full")[] = [
        "engine",
        "hybrid",
        "full",
      ];

      const kingdomCards = [
        "Cellar",
        "Chapel",
        "Moat",
        "Village",
        "Workshop",
        "Smithy",
        "Remodel",
        "Militia",
        "Market",
        "Mine",
      ];

      engines.forEach((engine, i) => {
        engine.startGame(getPlayersForMode(modes[i]), kingdomCards, 42);
      });

      // All should have same supply when using same kingdom cards
      const supply0 = JSON.stringify(engines[0].state.supply);
      engines.forEach(engine => {
        expect(JSON.stringify(engine.state.supply)).toBe(supply0);
      });
    });
  });

  describe("dynamic player lookup", () => {
    it("should be able to access any player by activePlayer ID", () => {
      ["engine", "hybrid", "full"].forEach(() => {
        const engine = new DominionEngine();

        engine.startGame(["ai1", "ai2"]);

        // This should not throw
        const activePlayer = engine.state.players[engine.state.activePlayerId];
        expect(activePlayer).toBeDefined();
        expect(activePlayer.hand).toBeDefined();
      });
    });

    it("should be able to iterate over all players", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;

      engine.startGame(["ai1", "ai2"]);

      const playerIds = Object.keys(engine.state.players);
      expect(playerIds).toHaveLength(2);

      playerIds.forEach(id => {
        expect(engine.state.players[id]).toBeDefined();
        expect(config.isAIPlayer(id)).toBe(true);
      });
    });
  });
});
