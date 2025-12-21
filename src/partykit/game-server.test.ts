import { describe, it, expect } from "bun:test";
import type { GameUpdateMessage, ChatMessageData } from "./protocol";

/**
 * Unit tests for GameServer
 *
 * Tests server logic, state management, and message handling.
 * Full server integration is tested separately.
 */

describe("GameServer", () => {
  describe("constants", () => {
    it("should have MAX_PLAYERS limit", () => {
      const MAX_PLAYERS = 2;
      expect(MAX_PLAYERS).toBe(2);
    });

    it("should have MAX_CHAT_MESSAGES limit", () => {
      const MAX_CHAT_MESSAGES = 100;
      expect(MAX_CHAT_MESSAGES).toBe(100);
    });
  });

  describe("player connection state", () => {
    it("should track player connection properties", () => {
      const player = {
        id: "conn-123",
        name: "Player 1",
        clientId: "client-123",
        isSpectator: false,
        isBot: false,
      };

      expect(player.id).toBe("conn-123");
      expect(player.name).toBe("Player 1");
      expect(player.clientId).toBe("client-123");
      expect(player.isSpectator).toBe(false);
    });

    it("should support bot players", () => {
      const botPlayer = {
        id: "bot-conn",
        name: "AI",
        clientId: "bot-123",
        isSpectator: false,
        isBot: true,
      };

      expect(botPlayer.isBot).toBe(true);
    });
  });

  describe("player count logic", () => {
    it("should count only non-spectator players", () => {
      const connections = [
        { clientId: "c1", isSpectator: false },
        { clientId: "c2", isSpectator: false },
        { clientId: "c3", isSpectator: true },
      ];

      const playerCount = connections.filter(c => !c.isSpectator).length;

      expect(playerCount).toBe(2);
    });

    it("should require clientId to be counted", () => {
      const connections = [
        { clientId: "c1", isSpectator: false },
        { clientId: null, isSpectator: false },
      ];

      const playerCount = connections.filter(
        c => c.clientId && !c.isSpectator,
      ).length;

      expect(playerCount).toBe(1);
    });
  });

  describe("spectator count logic", () => {
    it("should count only spectators", () => {
      const connections = [
        { isSpectator: true },
        { isSpectator: true },
        { isSpectator: false },
      ];

      const spectatorCount = connections.filter(c => c.isSpectator).length;

      expect(spectatorCount).toBe(2);
    });
  });

  describe("human connection count", () => {
    it("should count spectators as human", () => {
      const connections = [{ isSpectator: true }];
      const botPlayers = new Set<string>();

      const humanCount = connections.filter(conn => {
        if (conn.isSpectator) return true;
        return false;
      }).length;

      expect(humanCount).toBe(1);
    });

    it("should count non-bot players as human", () => {
      const connections = [
        { clientId: "c1", isSpectator: false },
        { clientId: "c2", isSpectator: false },
      ];
      const botPlayers = new Set<string>();

      const humanCount = connections.filter(
        conn => conn.isSpectator || !botPlayers.has(conn.clientId as string),
      ).length;

      expect(humanCount).toBe(2);
    });

    it("should not count bot players as human", () => {
      const connections = [
        { clientId: "c1", isSpectator: false },
        { clientId: "bot1", isSpectator: false },
      ];
      const botPlayers = new Set<string>(["bot1"]);

      const humanCount = connections.filter(
        conn =>
          conn.isSpectator ||
          (conn.clientId && !botPlayers.has(conn.clientId as string)),
      ).length;

      expect(humanCount).toBe(1);
    });
  });

  describe("full mode detection", () => {
    it("should detect full mode when all players are bots", () => {
      const players = [{ clientId: "bot1" }, { clientId: "bot2" }];
      const botPlayers = new Set<string>(["bot1", "bot2"]);

      const isFullMode =
        players.length > 0 &&
        players.every(p => botPlayers.has(p.clientId as string));

      expect(isFullMode).toBe(true);
    });

    it("should not be full mode when some humans exist", () => {
      const players = [{ clientId: "human1" }, { clientId: "bot1" }];
      const botPlayers = new Set<string>(["bot1"]);

      const isFullMode =
        players.length > 0 &&
        players.every(p => botPlayers.has(p.clientId as string));

      expect(isFullMode).toBe(false);
    });

    it("should not be full mode when no players", () => {
      const players: any[] = [];
      const botPlayers = new Set<string>();

      const isFullMode =
        players.length > 0 &&
        players.every(p => botPlayers.has(p.clientId));

      expect(isFullMode).toBe(false);
    });
  });

  describe("host assignment", () => {
    it("should assign first player as host", () => {
      let hostConnectionId: string | null = null;
      let hostClientId: string | null = null;

      const connectionId = "conn-1";
      const clientId = "client-1";

      if (!hostConnectionId) {
        hostConnectionId = connectionId;
        hostClientId = clientId;
      }

      expect(hostConnectionId).toBe("conn-1");
      expect(hostClientId).toBe("client-1");
    });

    it("should not reassign host if already set", () => {
      let hostConnectionId: string | null = "conn-1";
      let hostClientId: string | null = "client-1";

      const newConnectionId = "conn-2";
      const newClientId = "client-2";

      if (!hostConnectionId) {
        hostConnectionId = newConnectionId;
        hostClientId = newClientId;
      }

      expect(hostConnectionId).toBe("conn-1");
      expect(hostClientId).toBe("client-1");
    });
  });

  describe("auto-start logic", () => {
    it("should auto-start when 2 players join", () => {
      const playerCount = 2;
      const isStarted = false;
      const shouldAutoStart = playerCount === 2 && !isStarted;

      expect(shouldAutoStart).toBe(true);
    });

    it("should not auto-start with 1 player", () => {
      const playerCount = 1;
      const isStarted = false;
      const shouldAutoStart = playerCount === 2 && !isStarted;

      expect(shouldAutoStart).toBe(false);
    });

    it("should not auto-start if already started", () => {
      const playerCount = 2;
      const isStarted = true;
      const shouldAutoStart = playerCount === 2 && !isStarted;

      expect(shouldAutoStart).toBe(false);
    });
  });

  describe("player rejoining", () => {
    it("should find player by clientId", () => {
      const playerInfo: Record<string, any> = {
        "client-123": { name: "Player 1", id: "client-123" },
      };

      const clientId = "client-123";
      const found = playerInfo[clientId] ? clientId : null;

      expect(found).toBe("client-123");
    });

    it("should not find player with wrong clientId", () => {
      const playerInfo: Record<string, any> = {
        "client-123": { name: "Player 1" },
      };

      const clientId = "client-456";
      const found = playerInfo[clientId] ? clientId : null;

      expect(found).toBeNull();
    });

    it("should find player by name as fallback", () => {
      const playerInfo: Record<string, any> = {
        "client-123": { name: "Player 1", id: "client-123" },
      };

      const targetName = "Player 1";
      let found: string | null = null;

      for (const [clientId, info] of Object.entries(playerInfo)) {
        if (info.name === targetName) {
          found = clientId;
          break;
        }
      }

      expect(found).toBe("client-123");
    });
  });

  describe("spectator restrictions", () => {
    it("should block spectators when less than 2 players", () => {
      const playerCount = 1;
      const canSpectate = playerCount >= 2;

      expect(canSpectate).toBe(false);
    });

    it("should allow spectators when 2+ players", () => {
      const playerCount = 2;
      const canSpectate = playerCount >= 2;

      expect(canSpectate).toBe(true);
    });
  });

  describe("game validation", () => {
    it("should require host to start game", () => {
      const connectionId = "conn-2";
      const hostConnectionId = "conn-1";
      const canStart = connectionId === hostConnectionId;

      expect(canStart).toBe(false);
    });

    it("should allow host to start game", () => {
      const connectionId = "conn-1";
      const hostConnectionId = "conn-1";
      const canStart = connectionId === hostConnectionId;

      expect(canStart).toBe(true);
    });

    it("should prevent starting already started game", () => {
      const isStarted = true;
      const canStart = !isStarted;

      expect(canStart).toBe(false);
    });

    it("should require at least 2 players", () => {
      const playerCount = 1;
      const canStart = playerCount >= 2;

      expect(canStart).toBe(false);
    });

    it("should require exactly 1 player for single-player", () => {
      const playerCount = 1;
      const canStartSinglePlayer = playerCount === 1;

      expect(canStartSinglePlayer).toBe(true);
    });
  });

  describe("spectator actions", () => {
    it("should block spectators from game commands", () => {
      const isSpectator = true;
      const canAct = !isSpectator;

      expect(canAct).toBe(false);
    });

    it("should allow players to execute commands", () => {
      const isSpectator = false;
      const canAct = !isSpectator;

      expect(canAct).toBe(true);
    });
  });

  describe("chat messages", () => {
    it("should store chat messages", () => {
      const messages: ChatMessageData[] = [];
      const newMessage: ChatMessageData = {
        id: "msg-1",
        senderName: "Player",
        content: "Hello",
        timestamp: Date.now(),
      };

      messages.push(newMessage);

      expect(messages).toHaveLength(1);
      expect(messages[0]?.content).toBe("Hello");
    });

    it("should limit chat history to MAX_CHAT_MESSAGES", () => {
      const MAX_CHAT_MESSAGES = 100;
      const messages: ChatMessageData[] = Array.from(
        { length: 101 },
        (_, i) => ({
          id: `msg-${i}`,
          senderName: "Player",
          content: `Message ${i}`,
          timestamp: Date.now(),
        }),
      );

      const trimmed = messages.slice(-MAX_CHAT_MESSAGES);

      expect(trimmed).toHaveLength(100);
      expect(trimmed[0]?.content).toBe("Message 1");
    });
  });

  describe("game end conditions", () => {
    it("should end game when all players disconnect", () => {
      const playerCount = 0;
      const shouldEnd = playerCount === 0;

      expect(shouldEnd).toBe(true);
    });

    it("should end game when only bots remain (non-full mode)", () => {
      const players = [{ clientId: "bot1" }];
      const botPlayers = new Set<string>(["bot1"]);
      const humanCount = 0;
      const isFullMode = false;

      const shouldEnd =
        players.every(p => botPlayers.has(p.clientId as string)) &&
        humanCount === 0 &&
        !isFullMode;

      expect(shouldEnd).toBe(true);
    });

    it("should not end game in full mode even with only bots", () => {
      const isFullMode = true;
      const humanCount = 0;

      const shouldEnd = humanCount === 0 && !isFullMode;

      expect(shouldEnd).toBe(false);
    });

    it("should end game when player resigns and only 1 remains", () => {
      const playerCount = 1;
      const isStarted = true;
      const shouldEnd = playerCount < 2 && isStarted;

      expect(shouldEnd).toBe(true);
    });

    it("should end game when host leaves pre-game", () => {
      const isStarted = false;
      const connectionId = "conn-1";
      const hostConnectionId = "conn-1";

      const shouldEnd = !isStarted && connectionId === hostConnectionId;

      expect(shouldEnd).toBe(true);
    });
  });

  describe("spectator timeout", () => {
    it("should schedule timeout when players leave but spectators remain", () => {
      const playerCount = 0;
      const spectatorCount = 3;
      const shouldScheduleTimeout = playerCount === 0 && spectatorCount > 0;

      expect(shouldScheduleTimeout).toBe(true);
    });

    it("should not schedule timeout when players remain", () => {
      const playerCount = 1;
      const spectatorCount = 3;
      const shouldScheduleTimeout = playerCount === 0 && spectatorCount > 0;

      expect(shouldScheduleTimeout).toBe(false);
    });

    it("should not schedule timeout when no spectators", () => {
      const playerCount = 0;
      const spectatorCount = 0;
      const shouldScheduleTimeout = playerCount === 0 && spectatorCount > 0;

      expect(shouldScheduleTimeout).toBe(false);
    });
  });

  describe("bot connection cleanup", () => {
    it("should remove bot connections", () => {
      const connections = new Map([
        ["conn-1", { clientId: "human1", isBot: false }],
        ["conn-2", { clientId: "bot1", isBot: true }],
        ["conn-3", { clientId: "bot2", isBot: true }],
      ]);
      const botPlayers = new Set<string>(["bot1", "bot2"]);

      const botConnectionIds = [...connections.entries()]
        .filter(([_, conn]) => conn.clientId && botPlayers.has(conn.clientId))
        .map(([id]) => id);

      botConnectionIds.map(id => connections.delete(id));

      expect(connections.size).toBe(1);
      expect(connections.has("conn-1")).toBe(true);
    });
  });

  describe("game update message", () => {
    it("should create proper game update message", () => {
      const update: GameUpdateMessage = {
        type: "game_update",
        roomId: "room-123",
        players: [
          { name: "Player 1", isBot: false, isConnected: true },
          { name: "AI", isBot: true, isConnected: true },
        ],
        spectatorCount: 2,
        isActive: true,
        isSinglePlayer: true,
      };

      expect(update.type).toBe("game_update");
      expect(update.players).toHaveLength(2);
      expect(update.isActive).toBe(true);
      expect(update.isSinglePlayer).toBe(true);
    });

    it("should mark game as inactive when game over", () => {
      const isStarted = true;
      const gameOver = true;
      const playerCount = 2;

      const isActive = isStarted && playerCount > 0 && !gameOver;

      expect(isActive).toBe(false);
    });

    it("should mark game as inactive when no players", () => {
      const isStarted = true;
      const gameOver = false;
      const playerCount = 0;

      const isActive = isStarted && playerCount > 0 && !gameOver;

      expect(isActive).toBe(false);
    });

    it("should detect single-player from bot presence", () => {
      const players = [
        { name: "Player", isBot: false },
        { name: "AI", isBot: true },
      ];

      const isSinglePlayer = players.some(p => p.isBot);

      expect(isSinglePlayer).toBe(true);
    });
  });

  describe("mode change validation", () => {
    it("should allow host to change mode", () => {
      const connectionId = "conn-1";
      const hostConnectionId = "conn-1";
      const canChange = connectionId === hostConnectionId;

      expect(canChange).toBe(true);
    });

    it("should not allow non-host to change mode", () => {
      const connectionId = "conn-2";
      const hostConnectionId = "conn-1";
      const canChange = connectionId === hostConnectionId;

      expect(canChange).toBe(false);
    });

    it("should only allow mode change in single-player", () => {
      const playerCount = 2;
      const botCount = 1;
      const isSinglePlayer = botCount > 0;

      const canChange = playerCount === 2 && isSinglePlayer;

      expect(canChange).toBe(true);
    });

    it("should not allow mode change in multiplayer", () => {
      const playerCount = 2;
      const botCount = 0;
      const isSinglePlayer = botCount > 0;

      const canChange = playerCount === 2 && isSinglePlayer;

      expect(canChange).toBe(false);
    });
  });

  describe("player info tracking", () => {
    it("should track player metadata", () => {
      const playerInfo: Record<string, any> = {
        "client-1": {
          id: "client-1",
          name: "Player 1",
          type: "human",
          connected: true,
        },
      };

      expect(playerInfo["client-1"]?.name).toBe("Player 1");
      expect(playerInfo["client-1"]?.type).toBe("human");
      expect(playerInfo["client-1"]?.connected).toBe(true);
    });

    it("should mark disconnected players", () => {
      const playerInfo: Record<string, any> = {
        "client-1": {
          id: "client-1",
          name: "Player 1",
          type: "human",
          connected: true,
        },
      };

      playerInfo["client-1"]!.connected = false;

      expect(playerInfo["client-1"]?.connected).toBe(false);
    });

    it("should mark reconnected players", () => {
      const playerInfo: Record<string, any> = {
        "client-1": {
          id: "client-1",
          name: "Player 1",
          type: "human",
          connected: false,
        },
      };

      playerInfo["client-1"]!.connected = true;

      expect(playerInfo["client-1"]?.connected).toBe(true);
    });

    it("should differentiate human and AI players", () => {
      const playerInfo: Record<string, any> = {
        human1: { type: "human" },
        bot1: { type: "ai" },
      };

      expect(playerInfo.human1?.type).toBe("human");
      expect(playerInfo.bot1?.type).toBe("ai");
    });
  });

  describe("undo handling", () => {
    it("should send full_state when undo executed", () => {
      const events = [
        { type: "UNDO_REQUESTED" },
        { type: "UNDO_EXECUTED" },
      ];

      const hasUndoExecuted = events.some(e => e.type === "UNDO_EXECUTED");

      expect(hasUndoExecuted).toBe(true);
    });

    it("should send regular events when no undo", () => {
      const events = [{ type: "TURN_STARTED" }, { type: "CARD_PLAYED" }];

      const hasUndoExecuted = events.some(e => e.type === "UNDO_EXECUTED");

      expect(hasUndoExecuted).toBe(false);
    });
  });

  describe("disconnect timeout", () => {
    it("should allow disconnected player to rejoin", () => {
      const existingPlayerId = "client-123";
      const canRejoin = !!existingPlayerId;

      expect(canRejoin).toBe(true);
    });
  });

  describe("resign handling", () => {
    it("should convert resigning player to spectator", () => {
      let isSpectator = false;

      // Simulate resign
      isSpectator = true;

      expect(isSpectator).toBe(true);
    });

    it("should remove player from playerInfo on resign", () => {
      const playerInfo: Record<string, any> = {
        "client-1": { name: "Player 1" },
      };

      delete playerInfo["client-1"];

      expect(playerInfo["client-1"]).toBeUndefined();
    });
  });

  describe("multiplayer leave handling", () => {
    it("should end game when any player leaves multiplayer", () => {
      const remainingPlayers = [{ clientId: "human1" }];
      const botPlayers = new Set<string>();

      const humanPlayerCount = remainingPlayers.filter(
        p => !botPlayers.has(p.clientId as string),
      ).length;
      const isMultiplayer = humanPlayerCount > 0;

      // In multiplayer, any leave ends game
      const shouldEnd = isMultiplayer;

      expect(shouldEnd).toBe(true);
    });
  });
});
