import { describe, it, expect } from "bun:test";
import { DominionEngine } from "./engine";
import { GAME_MODE_CONFIG } from "../types/game-mode";

describe("Game initialization with different modes", () => {
  describe("engine mode", () => {
    it("should initialize with human and ai players", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.engine;

      const result = engine.startGame(config.players);

      expect(result.ok).toBe(true);
      expect(engine.state.players).toHaveProperty("human");
      expect(engine.state.players).toHaveProperty("ai");
      expect(Object.keys(engine.state.players)).toHaveLength(2);
    });

    it("should set first player as active", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.engine;

      engine.startGame(config.players);

      expect(engine.state.activePlayer).toBe(config.players[0]);
    });

    it("should correctly identify AI player during turns", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.engine;

      engine.startGame(config.players);

      // Check that isAIPlayer correctly identifies the AI
      expect(config.isAIPlayer(engine.state.activePlayer)).toBe(
        engine.state.activePlayer === "ai",
      );
    });
  });

  describe("hybrid mode", () => {
    it("should initialize with human and ai players", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.hybrid;

      const result = engine.startGame(config.players);

      expect(result.ok).toBe(true);
      expect(engine.state.players).toHaveProperty("human");
      expect(engine.state.players).toHaveProperty("ai");
      expect(Object.keys(engine.state.players)).toHaveLength(2);
    });

    it("should have same player structure as engine mode", () => {
      const engineMode = new DominionEngine();
      const hybridMode = new DominionEngine();

      engineMode.startGame(GAME_MODE_CONFIG.engine.players);
      hybridMode.startGame(GAME_MODE_CONFIG.hybrid.players);

      expect(Object.keys(engineMode.state.players).sort()).toEqual(
        Object.keys(hybridMode.state.players).sort(),
      );
    });
  });

  describe("full mode", () => {
    it("should initialize with ai1 and ai2 players", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;

      const result = engine.startGame(config.players);

      expect(result.ok).toBe(true);
      expect(engine.state.players).toHaveProperty("ai1");
      expect(engine.state.players).toHaveProperty("ai2");
      expect(Object.keys(engine.state.players)).toHaveLength(2);
    });

    it("should NOT have human or ai players", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;

      engine.startGame(config.players);

      expect(engine.state.players).not.toHaveProperty("human");
      expect(engine.state.players).not.toHaveProperty("ai");
    });

    it("should set ai1 as first player", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;

      engine.startGame(config.players);

      expect(engine.state.activePlayer).toBe("ai1");
    });

    it("should correctly identify both AI players", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;

      engine.startGame(config.players);

      expect(config.isAIPlayer("ai1")).toBe(true);
      expect(config.isAIPlayer("ai2")).toBe(true);
      expect(config.isAIPlayer("human")).toBe(false);
      expect(config.isAIPlayer("ai")).toBe(false);
    });

    it("should allow both AI players to take turns", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;

      engine.startGame(config.players);

      const initialPlayer = engine.state.activePlayer;
      expect(config.isAIPlayer(initialPlayer)).toBe(true);

      // End both phases for ai1 to complete turn
      if (engine.state.phase === "action") engine.endPhase("ai1");
      if (engine.state.phase === "buy") engine.endPhase("ai1");

      const nextPlayer = engine.state.activePlayer;
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

      engines.forEach(({ mode, engine }) => {
        const config = GAME_MODE_CONFIG[mode as keyof typeof GAME_MODE_CONFIG];
        engine.startGame(config.players);

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
      const config = GAME_MODE_CONFIG.full;

      engine.startGame(config.players);

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
      ["engine", "hybrid", "full"].forEach(mode => {
        const engine = new DominionEngine();
        const config = GAME_MODE_CONFIG[mode as keyof typeof GAME_MODE_CONFIG];

        engine.startGame(config.players);

        expect(engine.state.activePlayer).toBeTruthy();
        expect(engine.state.players).toHaveProperty(engine.state.activePlayer);
      });
    });

    it("should initialize supply with same kingdom cards when using same seed", () => {
      const engines = [
        new DominionEngine(),
        new DominionEngine(),
        new DominionEngine(),
      ];
      const configs = [
        GAME_MODE_CONFIG.engine,
        GAME_MODE_CONFIG.hybrid,
        GAME_MODE_CONFIG.full,
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
        engine.startGame(configs[i].players, kingdomCards, 42);
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
      ["engine", "hybrid", "full"].forEach(mode => {
        const engine = new DominionEngine();
        const config = GAME_MODE_CONFIG[mode as keyof typeof GAME_MODE_CONFIG];

        engine.startGame(config.players);

        // This should not throw
        const activePlayer = engine.state.players[engine.state.activePlayer];
        expect(activePlayer).toBeDefined();
        expect(activePlayer.hand).toBeDefined();
      });
    });

    it("should be able to iterate over all players", () => {
      const engine = new DominionEngine();
      const config = GAME_MODE_CONFIG.full;

      engine.startGame(config.players);

      const playerIds = Object.keys(engine.state.players);
      expect(playerIds).toHaveLength(2);

      playerIds.forEach(id => {
        expect(engine.state.players[id]).toBeDefined();
        expect(config.isAIPlayer(id)).toBe(true);
      });
    });
  });
});
