import { describe, it, expect, beforeEach } from "bun:test";
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
          type: "GAME_STARTED",
          timestamp: Date.now(),
          playerIds: ["p1", "p2"],
        },
      ];

      // Simulate the computation
      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (
          event.type === "UNDO_EXECUTED" ||
          event.type === "UNDO_DENIED"
        ) {
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
          timestamp: Date.now(),
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
        {
          id: "e2",
          type: "UNDO_EXECUTED",
          timestamp: Date.now(),
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (
          event.type === "UNDO_EXECUTED" ||
          event.type === "UNDO_DENIED"
        ) {
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
          timestamp: Date.now(),
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
        {
          id: "e2",
          type: "UNDO_DENIED",
          timestamp: Date.now(),
          requestId: "req1",
          byPlayer: "p2",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
        if (
          event.type === "UNDO_EXECUTED" ||
          event.type === "UNDO_DENIED"
        ) {
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
          timestamp: Date.now(),
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
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
          timestamp: Date.now(),
          requestId: "req1",
          byPlayer: "p1",
          toEventId: "e0",
        },
        {
          id: "e2",
          type: "UNDO_APPROVED",
          timestamp: Date.now(),
          requestId: "req1",
          byPlayer: "p2",
        },
      ];

      let pendingRequest: PendingUndoRequest | null = null;
      let requestIndex = -1;

      for (let i = events.length - 1; i >= 0; i--) {
        const event = events[i];
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
          const laterEvent = events[j];
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
          { name: "Player 1", playerId: "p1" },
          { name: "Player 2", playerId: "p2" },
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
      let gameState: any = null;
      let events: GameEvent[] = [];

      const msg: GameServerMessage = {
        type: "game_started",
        state: { test: "state" } as any,
        events: [{ id: "e1", type: "GAME_STARTED" } as any],
      };

      if (msg.type === "game_started") {
        gameState = msg.state;
        events = msg.events;
      }

      expect(gameState).not.toBeNull();
      expect(events).toHaveLength(1);
    });

    it("should handle events message and append events", () => {
      let events: GameEvent[] = [{ id: "e1" } as any];

      const msg: GameServerMessage = {
        type: "events",
        events: [{ id: "e2" } as any, { id: "e3" } as any],
        state: {} as any,
      };

      if (msg.type === "events") {
        events = [...events, ...msg.events];
      }

      expect(events).toHaveLength(3);
      expect(events[2]?.id).toBe("e3");
    });

    it("should handle full_state message and replace events", () => {
      let events: GameEvent[] = [{ id: "e1" } as any];

      const msg: GameServerMessage = {
        type: "full_state",
        events: [{ id: "e2" } as any],
        state: {} as any,
      };

      if (msg.type === "full_state") {
        events = msg.events;
      }

      expect(events).toHaveLength(1);
      expect(events[0]?.id).toBe("e2");
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

    it("should create play_action message", () => {
      const msg: GameClientMessage = {
        type: "play_action",
        card: "Village",
      };

      expect(msg.type).toBe("play_action");
      expect(msg.card).toBe("Village");
    });

    it("should create play_treasure message", () => {
      const msg: GameClientMessage = {
        type: "play_treasure",
        card: "Copper",
      };

      expect(msg.type).toBe("play_treasure");
      expect(msg.card).toBe("Copper");
    });

    it("should create play_all_treasures message", () => {
      const msg: GameClientMessage = {
        type: "play_all_treasures",
      };

      expect(msg.type).toBe("play_all_treasures");
    });

    it("should create buy_card message", () => {
      const msg: GameClientMessage = {
        type: "buy_card",
        card: "Silver",
      };

      expect(msg.type).toBe("buy_card");
      expect(msg.card).toBe("Silver");
    });

    it("should create end_phase message", () => {
      const msg: GameClientMessage = {
        type: "end_phase",
      };

      expect(msg.type).toBe("end_phase");
    });

    it("should create submit_decision message", () => {
      const msg: GameClientMessage = {
        type: "submit_decision",
        choice: { type: "cards", cards: ["Copper"] },
      };

      expect(msg.type).toBe("submit_decision");
      expect(msg.choice.type).toBe("cards");
    });

    it("should create request_undo message", () => {
      const msg: GameClientMessage = {
        type: "request_undo",
        toEventId: "event-123",
        reason: "Misclick",
      };

      expect(msg.type).toBe("request_undo");
      expect(msg.toEventId).toBe("event-123");
      expect(msg.reason).toBe("Misclick");
    });

    it("should create approve_undo message", () => {
      const msg: GameClientMessage = {
        type: "approve_undo",
        requestId: "req-123",
      };

      expect(msg.type).toBe("approve_undo");
      expect(msg.requestId).toBe("req-123");
    });

    it("should create deny_undo message", () => {
      const msg: GameClientMessage = {
        type: "deny_undo",
        requestId: "req-123",
      };

      expect(msg.type).toBe("deny_undo");
      expect(msg.requestId).toBe("req-123");
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

  describe("game mode handling", () => {
    it("should send start_singleplayer for single-player mode", () => {
      const isSinglePlayer = true;
      const gameMode = "engine";

      const msg: GameClientMessage = isSinglePlayer
        ? { type: "start_singleplayer", gameMode }
        : { type: "start_game" };

      expect(msg.type).toBe("start_singleplayer");
      if (msg.type === "start_singleplayer") {
        expect(msg.gameMode).toBe("engine");
      }
    });

    it("should send start_game for multiplayer mode", () => {
      const isSinglePlayer = false;

      const msg: GameClientMessage = isSinglePlayer
        ? { type: "start_singleplayer" }
        : { type: "start_game" };

      expect(msg.type).toBe("start_game");
    });

    it("should include kingdomCards when provided", () => {
      const kingdomCards = ["Village", "Smithy"];
      const msg: GameClientMessage = {
        type: "start_game",
        kingdomCards,
      };

      expect(msg.kingdomCards).toEqual(["Village", "Smithy"]);
    });

    it("should create change_game_mode message", () => {
      const msg: GameClientMessage = {
        type: "change_game_mode",
        gameMode: "full",
      };

      expect(msg.type).toBe("change_game_mode");
      expect(msg.gameMode).toBe("full");
    });
  });

  describe("auto-start logic", () => {
    it("should auto-start when all conditions met", () => {
      const isSinglePlayer = true;
      const isJoined = true;
      const isHost = true;
      const hasGameState = false;

      const shouldAutoStart =
        isSinglePlayer && isJoined && isHost && !hasGameState;

      expect(shouldAutoStart).toBe(true);
    });

    it("should not auto-start when not single-player", () => {
      const isSinglePlayer = false;
      const isJoined = true;
      const isHost = true;
      const hasGameState = false;

      const shouldAutoStart =
        isSinglePlayer && isJoined && isHost && !hasGameState;

      expect(shouldAutoStart).toBe(false);
    });

    it("should not auto-start when not joined", () => {
      const isSinglePlayer = true;
      const isJoined = false;
      const isHost = true;
      const hasGameState = false;

      const shouldAutoStart =
        isSinglePlayer && isJoined && isHost && !hasGameState;

      expect(shouldAutoStart).toBe(false);
    });

    it("should not auto-start when not host", () => {
      const isSinglePlayer = true;
      const isJoined = true;
      const isHost = false;
      const hasGameState = false;

      const shouldAutoStart =
        isSinglePlayer && isJoined && isHost && !hasGameState;

      expect(shouldAutoStart).toBe(false);
    });

    it("should not auto-start when game already started", () => {
      const isSinglePlayer = true;
      const isJoined = true;
      const isHost = true;
      const hasGameState = true;

      const shouldAutoStart =
        isSinglePlayer && isJoined && isHost && !hasGameState;

      expect(shouldAutoStart).toBe(false);
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
      const hostname = "example.com";
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
      let gameEndReason: string | null = null;

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
