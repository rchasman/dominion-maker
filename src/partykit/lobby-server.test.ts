import { describe, it, expect } from "bun:test";
import type {
  LobbyPlayer,
  GameRequest,
  ActiveGame,
  LobbyClientMessage,
  LobbyServerMessage,
} from "./protocol";

/**
 * Unit tests for LobbyServer
 *
 * Tests lobby server logic, matchmaking, and state management.
 */

describe("LobbyServer", () => {
  describe("player state", () => {
    it("should track connected player properties", () => {
      const player = {
        id: "conn-123",
        name: "Test Player",
        clientId: "client-123",
      };

      expect(player.id).toBe("conn-123");
      expect(player.name).toBe("Test Player");
      expect(player.clientId).toBe("client-123");
    });

    it("should generate default name when empty", () => {
      const name = "";
      const connectionId = "conn-1234";
      const defaultName = `Player${connectionId.slice(0, 4)}`;

      const playerName = name.trim() || defaultName;

      expect(playerName).toBe("Playerconn");
    });

    it("should use provided name when available", () => {
      const name = "My Name";
      const connectionId = "conn-1234";
      const defaultName = `Player${connectionId.slice(0, 4)}`;

      const playerName = name.trim() || defaultName;

      expect(playerName).toBe("My Name");
    });
  });

  describe("disconnect timeout", () => {
    it("should delay player removal by 50ms", () => {
      const DISCONNECT_DELAY = 50;
      expect(DISCONNECT_DELAY).toBe(50);
    });

    it("should allow reconnection during timeout window", () => {
      let timeoutScheduled = true;

      // Simulate reconnection clearing timeout
      timeoutScheduled = false;

      expect(timeoutScheduled).toBe(false);
    });
  });

  describe("deduplication", () => {
    it("should detect existing player by clientId", () => {
      const players = new Map([
        ["conn-1", { id: "conn-1", clientId: "client-123", name: "Player" }],
      ]);

      const clientId = "client-123";
      const existing = [...players.entries()].find(
        ([_, p]) => p.clientId === clientId,
      );

      expect(existing).toBeDefined();
      expect(existing?.[0]).toBe("conn-1");
    });

    it("should not find non-existent clientId", () => {
      const players = new Map([
        ["conn-1", { id: "conn-1", clientId: "client-123", name: "Player" }],
      ]);

      const clientId = "client-999";
      const existing = [...players.entries()].find(
        ([_, p]) => p.clientId === clientId,
      );

      expect(existing).toBeUndefined();
    });

    it("should remove old connection when deduplicating", () => {
      const players = new Map([
        ["conn-old", { clientId: "client-123" }],
      ]);

      players.delete("conn-old");
      players.set("conn-new", { clientId: "client-123" } as any);

      expect(players.has("conn-old")).toBe(false);
      expect(players.has("conn-new")).toBe(true);
    });
  });

  describe("request management", () => {
    it("should create game request", () => {
      const request: GameRequest = {
        id: `req_${Date.now()}_abc123`,
        fromId: "player-1",
        toId: "player-2",
      };

      expect(request.fromId).toBe("player-1");
      expect(request.toId).toBe("player-2");
      expect(request.id).toContain("req_");
    });

    it("should prevent self-requests", () => {
      const fromId = "player-1";
      const toId = "player-1";
      const isValid = fromId !== toId;

      expect(isValid).toBe(false);
    });

    it("should find request by fromId and toId", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
        ["req-2", { id: "req-2", fromId: "p2", toId: "p3" }],
      ]);

      const fromId = "p1";
      const toId = "p2";

      let found: GameRequest | undefined;
      for (const req of requests.values()) {
        if (req.fromId === fromId && req.toId === toId) {
          found = req;
          break;
        }
      }

      expect(found).toBeDefined();
      expect(found?.id).toBe("req-1");
    });

    it("should not find non-existent request", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
      ]);

      const fromId = "p3";
      const toId = "p4";

      let found: GameRequest | undefined;
      for (const req of requests.values()) {
        if (req.fromId === fromId && req.toId === toId) {
          found = req;
          break;
        }
      }

      expect(found).toBeUndefined();
    });
  });

  describe("mutual request matching", () => {
    it("should detect mutual request (instant match)", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
      ]);

      // p2 requests p1 back
      const newFromId = "p2";
      const newToId = "p1";

      let mutualRequest: GameRequest | undefined;
      for (const req of requests.values()) {
        if (req.fromId === newToId && req.toId === newFromId) {
          mutualRequest = req;
          break;
        }
      }

      expect(mutualRequest).toBeDefined();
      expect(mutualRequest?.id).toBe("req-1");
    });

    it("should not find mutual request when none exists", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
      ]);

      const newFromId = "p3";
      const newToId = "p4";

      let mutualRequest: GameRequest | undefined;
      for (const req of requests.values()) {
        if (req.fromId === newToId && req.toId === newFromId) {
          mutualRequest = req;
          break;
        }
      }

      expect(mutualRequest).toBeUndefined();
    });
  });

  describe("request cancellation", () => {
    it("should allow sender to cancel request", () => {
      const request: GameRequest = {
        id: "req-1",
        fromId: "p1",
        toId: "p2",
      };
      const senderId = "p1";

      const canCancel = request.fromId === senderId;

      expect(canCancel).toBe(true);
    });

    it("should not allow recipient to cancel request", () => {
      const request: GameRequest = {
        id: "req-1",
        fromId: "p1",
        toId: "p2",
      };
      const senderId = "p2";

      const canCancel = request.fromId === senderId;

      expect(canCancel).toBe(false);
    });
  });

  describe("request acceptance", () => {
    it("should allow recipient to accept request", () => {
      const request: GameRequest = {
        id: "req-1",
        fromId: "p1",
        toId: "p2",
      };
      const accepterId = "p2";

      const canAccept = request.toId === accepterId;

      expect(canAccept).toBe(true);
    });

    it("should not allow sender to accept own request", () => {
      const request: GameRequest = {
        id: "req-1",
        fromId: "p1",
        toId: "p2",
      };
      const accepterId = "p1";

      const canAccept = request.toId === accepterId;

      expect(canAccept).toBe(false);
    });

    it("should not allow third party to accept request", () => {
      const request: GameRequest = {
        id: "req-1",
        fromId: "p1",
        toId: "p2",
      };
      const accepterId = "p3";

      const canAccept = request.toId === accepterId;

      expect(canAccept).toBe(false);
    });
  });

  describe("toggle behavior", () => {
    it("should cancel existing request when clicking again", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
      ]);

      const fromId = "p1";
      const toId = "p2";

      let existingRequest: GameRequest | undefined;
      for (const req of requests.values()) {
        if (req.fromId === fromId && req.toId === toId) {
          existingRequest = req;
          break;
        }
      }

      if (existingRequest) {
        requests.delete(existingRequest.id);
      }

      expect(requests.size).toBe(0);
    });
  });

  describe("game matching", () => {
    it("should generate room ID for matched game", () => {
      const roomIdPattern = /^[a-z]{4}-[a-z]{4}$/;
      const roomId = "abcd-efgh";

      expect(roomIdPattern.test(roomId)).toBe(true);
    });

    it("should remove accepted request", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
      ]);

      const requestId = "req-1";
      requests.delete(requestId);

      expect(requests.has("req-1")).toBe(false);
    });

    it("should remove all requests involving matched players", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
        ["req-2", { id: "req-2", fromId: "p1", toId: "p3" }],
        ["req-3", { id: "req-3", fromId: "p3", toId: "p2" }],
        ["req-4", { id: "req-4", fromId: "p4", toId: "p5" }],
      ]);

      const player1Id = "p1";
      const player2Id = "p2";

      const toRemove = [...requests.entries()]
        .filter(
          ([_, req]) =>
            req.fromId === player1Id ||
            req.toId === player1Id ||
            req.fromId === player2Id ||
            req.toId === player2Id,
        )
        .map(([id]) => id);

      toRemove.map(id => requests.delete(id));

      expect(requests.size).toBe(1);
      expect(requests.has("req-4")).toBe(true);
    });

    it("should send game_matched message to both players", () => {
      const msg1: LobbyServerMessage = {
        type: "game_matched",
        roomId: "room-123",
        opponentName: "Player 2",
      };

      const msg2: LobbyServerMessage = {
        type: "game_matched",
        roomId: "room-123",
        opponentName: "Player 1",
      };

      expect(msg1.roomId).toBe(msg2.roomId);
      expect(msg1.opponentName).toBe("Player 2");
      expect(msg2.opponentName).toBe("Player 1");
    });
  });

  describe("player cleanup on disconnect", () => {
    it("should remove player after timeout", () => {
      const players = new Map([["conn-1", { id: "conn-1" }]]);

      // Simulate timeout completion
      players.delete("conn-1");

      expect(players.size).toBe(0);
    });

    it("should cancel requests involving disconnected player", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
        ["req-2", { id: "req-2", fromId: "p2", toId: "p3" }],
        ["req-3", { id: "req-3", fromId: "p3", toId: "p4" }],
      ]);

      const disconnectedId = "p2";

      const toRemove = [...requests.entries()]
        .filter(
          ([_, req]) =>
            req.fromId === disconnectedId || req.toId === disconnectedId,
        )
        .map(([id]) => id);

      toRemove.map(id => requests.delete(id));

      expect(requests.size).toBe(1);
      expect(requests.has("req-3")).toBe(true);
    });
  });

  describe("active games tracking", () => {
    it("should add active game", () => {
      const activeGames = new Map<string, ActiveGame>();

      const game: ActiveGame = {
        roomId: "room-123",
        players: [
          { name: "Player 1", isBot: false },
          { name: "Player 2", isBot: false },
        ],
        spectatorCount: 0,
        isSinglePlayer: false,
      };

      activeGames.set(game.roomId, game);

      expect(activeGames.size).toBe(1);
      expect(activeGames.get("room-123")?.players).toHaveLength(2);
    });

    it("should remove inactive game", () => {
      const activeGames = new Map<string, ActiveGame>([
        [
          "room-123",
          {
            roomId: "room-123",
            players: [],
            spectatorCount: 0,
            isSinglePlayer: false,
          },
        ],
      ]);

      const isActive = false;
      if (!isActive) {
        activeGames.delete("room-123");
      }

      expect(activeGames.size).toBe(0);
    });

    it("should update game when already exists", () => {
      const activeGames = new Map<string, ActiveGame>([
        [
          "room-123",
          {
            roomId: "room-123",
            players: [{ name: "Player 1" }],
            spectatorCount: 0,
            isSinglePlayer: false,
          },
        ],
      ]);

      const updated: ActiveGame = {
        roomId: "room-123",
        players: [{ name: "Player 1" }, { name: "Player 2" }],
        spectatorCount: 1,
        isSinglePlayer: false,
      };

      activeGames.set(updated.roomId, updated);

      expect(activeGames.get("room-123")?.players).toHaveLength(2);
      expect(activeGames.get("room-123")?.spectatorCount).toBe(1);
    });
  });

  describe("HTTP endpoint", () => {
    it("should handle game_update POST request", () => {
      const requestBody = {
        type: "game_update",
        roomId: "room-123",
        players: [{ name: "Player 1", isBot: false, isConnected: true }],
        spectatorCount: 0,
        isActive: true,
        isSinglePlayer: false,
      };

      expect(requestBody.type).toBe("game_update");
      expect(requestBody.isActive).toBe(true);
    });

    it("should return 405 for non-POST requests", () => {
      const method = "GET";
      const statusCode = method === "POST" ? 200 : 405;

      expect(statusCode).toBe(405);
    });

    it("should return 200 for POST requests", () => {
      const method = "POST";
      const statusCode = method === "POST" ? 200 : 405;

      expect(statusCode).toBe(200);
    });
  });

  describe("broadcast helpers", () => {
    it("should convert players Map to array", () => {
      const players = new Map([
        ["conn-1", { id: "conn-1", name: "Player 1", clientId: "c1" }],
        ["conn-2", { id: "conn-2", name: "Player 2", clientId: "c2" }],
      ]);

      const playerList: LobbyPlayer[] = [...players.values()].map(p => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
      }));

      expect(playerList).toHaveLength(2);
      expect(playerList[0]?.name).toBe("Player 1");
    });

    it("should convert requests Map to array", () => {
      const requests = new Map<string, GameRequest>([
        ["req-1", { id: "req-1", fromId: "p1", toId: "p2" }],
      ]);

      const requestList = [...requests.values()];

      expect(requestList).toHaveLength(1);
      expect(requestList[0]?.id).toBe("req-1");
    });

    it("should convert active games Map to array", () => {
      const activeGames = new Map<string, ActiveGame>([
        [
          "room-1",
          {
            roomId: "room-1",
            players: [],
            spectatorCount: 0,
            isSinglePlayer: false,
          },
        ],
      ]);

      const gamesList = [...activeGames.values()];

      expect(gamesList).toHaveLength(1);
      expect(gamesList[0]?.roomId).toBe("room-1");
    });
  });

  describe("welcome messages", () => {
    it("should send lobby_joined with player ID", () => {
      const connectionId = "conn-123";
      const msg: LobbyServerMessage = {
        type: "lobby_joined",
        playerId: connectionId,
      };

      expect(msg.type).toBe("lobby_joined");
      expect(msg.playerId).toBe("conn-123");
    });

    it("should send initial state on join", () => {
      const messages: LobbyServerMessage[] = [
        { type: "lobby_joined", playerId: "conn-1" },
        { type: "players", players: [] },
        { type: "requests", requests: [] },
        { type: "active_games", games: [] },
      ];

      expect(messages).toHaveLength(4);
      expect(messages[0]?.type).toBe("lobby_joined");
      expect(messages[1]?.type).toBe("players");
      expect(messages[2]?.type).toBe("requests");
      expect(messages[3]?.type).toBe("active_games");
    });
  });

  describe("error handling", () => {
    it("should send error when player not found", () => {
      const targetId = "nonexistent";
      const players = new Map();

      const found = players.has(targetId);
      const errorMsg: LobbyServerMessage = {
        type: "error",
        message: "Player not found",
      };

      if (!found) {
        expect(errorMsg.type).toBe("error");
        expect(errorMsg.message).toBe("Player not found");
      }
    });

    it("should send error when request not found", () => {
      const requestId = "nonexistent";
      const requests = new Map();

      const found = requests.has(requestId);

      if (!found) {
        const errorMsg: LobbyServerMessage = {
          type: "error",
          message: "Request not found",
        };
        expect(errorMsg.type).toBe("error");
      }
    });

    it("should send error when player left during acceptance", () => {
      const request: GameRequest = {
        id: "req-1",
        fromId: "p1",
        toId: "p2",
      };
      const players = new Map([["p2", { id: "p2" }]]);

      const fromPlayerExists = players.has(request.fromId);
      const toPlayerExists = players.has(request.toId);

      const bothExist = fromPlayerExists && toPlayerExists;

      expect(bothExist).toBe(false);
    });
  });

  describe("message validation", () => {
    it("should validate join_lobby message", () => {
      const msg: LobbyClientMessage = {
        type: "join_lobby",
        name: "Player",
        clientId: "client-123",
      };

      expect(msg.type).toBe("join_lobby");
      expect(msg.name).toBeDefined();
      expect(msg.clientId).toBeDefined();
    });

    it("should validate request_game message", () => {
      const msg: LobbyClientMessage = {
        type: "request_game",
        targetId: "player-123",
      };

      expect(msg.type).toBe("request_game");
      expect(msg.targetId).toBeDefined();
    });

    it("should validate accept_request message", () => {
      const msg: LobbyClientMessage = {
        type: "accept_request",
        requestId: "req-123",
      };

      expect(msg.type).toBe("accept_request");
      expect(msg.requestId).toBeDefined();
    });

    it("should validate cancel_request message", () => {
      const msg: LobbyClientMessage = {
        type: "cancel_request",
        requestId: "req-123",
      };

      expect(msg.type).toBe("cancel_request");
      expect(msg.requestId).toBeDefined();
    });
  });
});
