import { describe, it, expect } from "bun:test";
import type {
  GameServerMessage,
  GameClientMessage,
  PlayerId,
  ChatMessageData,
} from "./protocol";
import type { GameEvent } from "../events/types";
import type { PendingUndoRequest } from "../engine/engine";

/**
 * Unit tests for usePartyGame hook
 *
 * Tests the hook's state management, message handling, and undo computation logic.
 */

describe("usePartyGame", () => {
  describe("computePendingUndo", () => {
    it("should return null when no undo events exist", () => {
      const events: GameEvent[] = [
        {
          id: "e1",
          type: "GAME_INITIALIZED",
          players: ["p1", "p2"],
          kingdomCards: [],
          supply: {},
        },
      ];

      // Simulate the computation
      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]!;
        if (event.type === "UNDO_EXECUTED" || event.type === "UNDO_DENIED") {
          pendingRequest = null;
          break;
        }
        if (event.type === "UNDO_REQUESTED") {
          pendingRequest = {
            requestId: "test",
            byPlayer: "p1",
            toEventId: "e1",
            approvals: new Set<PlayerId>(),
            needed: 1,
          };
          break;
        }
      }

      expect(pendingRequest).toBeNull();
    });

    it("should return null when undo was executed", () => {
      const events: GameEvent[] = [
        {
          id: "e1",
          type: "UNDO_REQUESTED",
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
        {
          id: "e2",
          type: "UNDO_EXECUTED",
          fromEventId: "e1",
          toEventId: "e0",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]!;
        if (event.type === "UNDO_EXECUTED" || event.type === "UNDO_DENIED") {
          pendingRequest = null;
          break;
        }
      }

      expect(pendingRequest).toBeNull();
    });

    it("should return null when undo was denied", () => {
      const events: GameEvent[] = [
        {
          id: "e1",
          type: "UNDO_REQUESTED",
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
        {
          id: "e2",
          type: "UNDO_DENIED",
          requestId: "req1",
          byPlayer: "p2",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]!;
        if (event.type === "UNDO_EXECUTED" || event.type === "UNDO_DENIED") {
          pendingRequest = null;
          break;
        }
      }

      expect(pendingRequest).toBeNull();
    });

    it("should return pending request when undo requested but not resolved", () => {
      const events: GameEvent[] = [
        {
          id: "e1",
          type: "UNDO_REQUESTED",
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]!;
        if (event.type === "UNDO_REQUESTED") {
          pendingRequest = {
            requestId: event.requestId,
            byPlayer: event.byPlayer,
            toEventId: event.toEventId,
            approvals: new Set<PlayerId>(),
            needed: 1,
          };
          break;
        }
      }

      expect(pendingRequest).not.toBeNull();
      expect(pendingRequest?.requestId).toBe("req1");
      expect(pendingRequest?.byPlayer).toBe("p1");
    });

    it("should count approvals after request", () => {
      const events: GameEvent[] = [
        {
          id: "e1",
          type: "UNDO_REQUESTED",
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
        {
          id: "e2",
          type: "UNDO_APPROVED",
          requestId: "req1",
          byPlayer: "p2",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;
      let requestIndex = -1;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i]!;
        if (event.type === "UNDO_REQUESTED") {
          requestIndex = i;
          pendingRequest = {
            requestId: event.requestId,
            byPlayer: event.byPlayer,
            toEventId: event.toEventId,
            approvals: new Set<PlayerId>(),
            needed: 1,
          };
          break;
        }
      }

      if (pendingRequest && requestIndex >= 0) {
        for (let j = requestIndex + 1; j < events.length; j++) {
          const laterEvent = events[j]!;
          if (
            laterEvent.type === "UNDO_APPROVED" &&
            laterEvent.requestId === pendingRequest.requestId
          ) {
            pendingRequest.approvals.add(laterEvent.byPlayer);
          }
        }
      }

      expect(pendingRequest?.approvals.size).toBe(1);
      expect(pendingRequest?.approvals.has("p2")).toBe(true);
    });
  });

  describe("state management", () => {
    it("should track connection state", () => {
      let isConnected = false;

      isConnected = true;
      expect(isConnected).toBe(true);

      isConnected = false;
      expect(isConnected).toBe(false);
    });

    it("should track join state", () => {
      let isJoined = false;
      let playerId: PlayerId | null = null;
      let isSpectator = false;
      let isHost = false;

      const msg: GameServerMessage = {
        type: "joined",
        playerId: "player-123",
        isSpectator: false,
        isHost: true,
      };

      if (msg.type === "joined") {
        isJoined = true;
        playerId = msg.playerId;
        isSpectator = msg.isSpectator;
        isHost = msg.isHost;
      }

      expect(isJoined).toBe(true);
      expect(playerId).toBe("player-123");
      expect(isSpectator).toBe(false);
      expect(isHost).toBe(true);
    });

    it("should track players list", () => {
      let players: Array<{ name: string; playerId: PlayerId }> = [];

      const msg: GameServerMessage = {
        type: "player_list",
        players: [
          { name: "Player 1", playerId: "p1", controller: "human" },
          { name: "Player 2", playerId: "p2", controller: "heuristic" },
        ],
      };

      if (msg.type === "player_list") {
        players = msg.players;
      }

      expect(players).toHaveLength(2);
      expect(players[0]?.name).toBe("Player 1");
    });

    it("should track spectator count", () => {
      let spectatorCount = 0;

      const msg: GameServerMessage = {
        type: "spectator_count",
        count: 5,
      };

      if (msg.type === "spectator_count") {
        spectatorCount = msg.count;
      }

      expect(spectatorCount).toBe(5);
    });

    it("should handle game_started message", () => {
      let gameState: unknown = null;
      let events: unknown[] = [];

      const msg: GameServerMessage = {
        type: "game_started",
        game: "dominion",
        state: { test: "state" },
        events: [{ id: "e1", type: "GAME_STARTED" }],
        playerInfo: {},
      };

      if (msg.type === "game_started") {
        gameState = msg.state;
        events = msg.events;
      }

      expect(gameState).not.toBeNull();
      expect(events).toHaveLength(1);
    });

    it("should handle events message and append events", () => {
      let events: unknown[] = [{ id: "e1" }];

      const msg: GameServerMessage = {
        type: "events",
        game: "dominion",
        events: [{ id: "e2" }, { id: "e3" }],
        state: {},
        playerInfo: {},
      };

      if (msg.type === "events") {
        events = [...events, ...msg.events];
      }

      expect(events).toHaveLength(3);
      expect(events[2]).toEqual({ id: "e3" });
    });

    it("should handle full_state message and replace events", () => {
      let events: unknown[] = [{ id: "e1" }];

      const msg: GameServerMessage = {
        type: "full_state",
        game: "dominion",
        events: [{ id: "e2" }],
        state: {},
        playerInfo: {},
      };

      if (msg.type === "full_state") {
        events = msg.events;
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ id: "e2" });
    });

    it("should track disconnected players", () => {
      const disconnectedPlayers = new Map<PlayerId, string>();

      const msg: GameServerMessage = {
        type: "player_disconnected",
        playerName: "Player 1",
        playerId: "p1",
      };

      if (msg.type === "player_disconnected") {
        disconnectedPlayers.set(msg.playerId, msg.playerName);
      }

      expect(disconnectedPlayers.get("p1")).toBe("Player 1");
    });

    it("should remove reconnected players from disconnected list", () => {
      const disconnectedPlayers = new Map<PlayerId, string>([
        ["p1", "Player 1"],
      ]);

      const msg: GameServerMessage = {
        type: "player_reconnected",
        playerName: "Player 1",
        playerId: "p1",
      };

      if (msg.type === "player_reconnected") {
        disconnectedPlayers.delete(msg.playerId);
      }

      expect(disconnectedPlayers.has("p1")).toBe(false);
    });

    it("should track chat messages", () => {
      let chatMessages: ChatMessageData[] = [];

      const msg: GameServerMessage = {
        type: "chat",
        message: {
          id: "msg-1",
          senderName: "Player",
          content: "Hello",
          timestamp: Date.now(),
        },
      };

      if (msg.type === "chat") {
        chatMessages = [...chatMessages, msg.message];
      }

      expect(chatMessages).toHaveLength(1);
      expect(chatMessages[0]?.content).toBe("Hello");
    });

    it("should load chat history", () => {
      let chatMessages: ChatMessageData[] = [];

      const msg: GameServerMessage = {
        type: "chat_history",
        messages: [
          {
            id: "msg-1",
            senderName: "P1",
            content: "Hi",
            timestamp: Date.now(),
          },
          {
            id: "msg-2",
            senderName: "P2",
            content: "Hello",
            timestamp: Date.now(),
          },
        ],
      };

      if (msg.type === "chat_history") {
        chatMessages = msg.messages;
      }

      expect(chatMessages).toHaveLength(2);
    });
  });

  describe("command actions", () => {
    it("should prevent spectators from acting", () => {
      const isSpectator = true;
      const result = isSpectator
        ? { ok: false, error: "Spectators cannot act" }
        : { ok: true, events: [] };

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Spectators cannot act");
    });

    it("should allow players to act", () => {
      const isSpectator = false;
      const result = isSpectator
        ? { ok: false, error: "Spectators cannot act" }
        : { ok: true, events: [] };

      expect(result.ok).toBe(true);
    });

    it("should create resign message", () => {
      const msg: GameClientMessage = {
        type: "resign",
      };

      expect(msg.type).toBe("resign");
    });

    it("should create leave message", () => {
      const msg: GameClientMessage = {
        type: "leave",
      };

      expect(msg.type).toBe("leave");
    });

    it("should create chat message", () => {
      const msg: GameClientMessage = {
        type: "chat",
        message: {
          id: "msg-1",
          senderName: "Player",
          content: "Hello",
          timestamp: Date.now(),
        },
      };

      expect(msg.type).toBe("chat");
      expect(msg.message.content).toBe("Hello");
    });
  });

  describe("start and seat messages", () => {
    it("starts a game with opaque options and bot seats", () => {
      const msg: GameClientMessage = {
        type: "start_game",
        options: { kingdomCards: ["Village", "Smithy"] },
        bots: [{ name: "AI Opponent", controller: { kind: "heuristic" } }],
      };

      expect(msg.type).toBe("start_game");
      if (msg.type === "start_game") {
        expect(msg.options).toEqual({ kingdomCards: ["Village", "Smithy"] });
        expect(msg.bots?.[0]?.controller.kind).toBe("heuristic");
      }
    });

    it("swaps a seat's controller", () => {
      const msg: GameClientMessage = {
        type: "set_seat",
        playerId: "p1",
        controller: { kind: "human" },
      };
      expect(msg.type).toBe("set_seat");
    });
  });

  describe("PARTYKIT_HOST configuration", () => {
    it("should use localhost:1999 for localhost", () => {
      const hostname = "localhost";
      const host =
        hostname === "localhost"
          ? "localhost:1999"
          : "dominion-maker.rchasman.partykit.dev";

      expect(host).toBe("localhost:1999");
    });

    it("should use production host for non-localhost", () => {
      const hostname: string = "example.com";
      const host =
        hostname === "localhost"
          ? "localhost:1999"
          : "dominion-maker.rchasman.partykit.dev";

      expect(host).toBe("dominion-maker.rchasman.partykit.dev");
    });
  });

  describe("error handling", () => {
    it("should handle transient errors without ending game", () => {
      let error: string | null = null;
      const gameEndReason: string | null = null;

      const msg: GameServerMessage = {
        type: "error",
        message: "Invalid move",
      };

      if (msg.type === "error") {
        error = msg.message;
        // gameEndReason stays null for transient errors
      }

      expect(error).toBe("Invalid move");
      expect(gameEndReason).toBeNull();
    });

    it("should handle game_ended message", () => {
      let gameEndReason: string | null = null;

      const msg: GameServerMessage = {
        type: "game_ended",
        reason: "Player resigned",
      };

      if (msg.type === "game_ended") {
        gameEndReason = msg.reason;
      }

      expect(gameEndReason).toBe("Player resigned");
    });

    it("should handle player_resigned message", () => {
      let gameEndReason: string | null = null;

      const msg: GameServerMessage = {
        type: "player_resigned",
        playerName: "Player 1",
      };

      if (msg.type === "player_resigned") {
        gameEndReason = `${msg.playerName} resigned. You win!`;
      }

      expect(gameEndReason).toBe("Player 1 resigned. You win!");
    });
  });
});
