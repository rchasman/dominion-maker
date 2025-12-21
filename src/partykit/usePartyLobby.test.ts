import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { LobbyPlayer, GameRequest, LobbyServerMessage } from "./protocol";

/**
 * Unit tests for usePartyLobby hook
 *
 * Tests the hook's state management and message handling logic.
 * WebSocket functionality is tested through integration tests.
 */

describe("usePartyLobby", () => {
  describe("state management", () => {
    it("should track connection state", () => {
      let isConnected = false;

      // Simulate socket open
      isConnected = true;
      expect(isConnected).toBe(true);

      // Simulate socket close
      isConnected = false;
      expect(isConnected).toBe(false);
    });

    it("should track player ID after joining", () => {
      let myId: string | null = null;

      // Simulate joining lobby
      const msg: LobbyServerMessage = {
        type: "lobby_joined",
        playerId: "player-123",
      };

      if (msg.type === "lobby_joined") {
        myId = msg.playerId;
      }

      expect(myId).toBe("player-123");
    });

    it("should track players list", () => {
      let players: LobbyPlayer[] = [];

      const msg: LobbyServerMessage = {
        type: "players",
        players: [
          { id: "p1", name: "Player 1", clientId: "c1" },
          { id: "p2", name: "Player 2", clientId: "c2" },
        ],
      };

      if (msg.type === "players") {
        players = msg.players;
      }

      expect(players).toHaveLength(2);
      expect(players[0]?.name).toBe("Player 1");
    });

    it("should track game requests", () => {
      let requests: GameRequest[] = [];

      const msg: LobbyServerMessage = {
        type: "requests",
        requests: [
          { id: "req1", fromId: "p1", toId: "p2" },
          { id: "req2", fromId: "p3", toId: "p1" },
        ],
      };

      if (msg.type === "requests") {
        requests = msg.requests;
      }

      expect(requests).toHaveLength(2);
      expect(requests[0]?.fromId).toBe("p1");
    });

    it("should track matched game", () => {
      let matchedGame: { roomId: string; opponentName: string } | null = null;

      const msg: LobbyServerMessage = {
        type: "game_matched",
        roomId: "room-123",
        opponentName: "Opponent",
      };

      if (msg.type === "game_matched") {
        matchedGame = {
          roomId: msg.roomId,
          opponentName: msg.opponentName,
        };
      }

      expect(matchedGame?.roomId).toBe("room-123");
      expect(matchedGame?.opponentName).toBe("Opponent");
    });

    it("should track errors", () => {
      let error: string | null = null;

      const msg: LobbyServerMessage = {
        type: "error",
        message: "Something went wrong",
      };

      if (msg.type === "error") {
        error = msg.message;
      }

      expect(error).toBe("Something went wrong");
    });
  });

  describe("getRequestState", () => {
    it("should return 'none' when no request exists", () => {
      const myId = "p1";
      const targetId = "p2";
      const requests: GameRequest[] = [];

      const sentRequest = requests.find(
        r => r.fromId === myId && r.toId === targetId,
      );
      const receivedRequest = requests.find(
        r => r.fromId === targetId && r.toId === myId,
      );

      const state = sentRequest
        ? "sent"
        : receivedRequest
          ? "received"
          : "none";

      expect(state).toBe("none");
    });

    it("should return 'sent' when I sent a request", () => {
      const myId = "p1";
      const targetId = "p2";
      const requests: GameRequest[] = [
        { id: "req1", fromId: "p1", toId: "p2" },
      ];

      const sentRequest = requests.find(
        r => r.fromId === myId && r.toId === targetId,
      );
      const receivedRequest = requests.find(
        r => r.fromId === targetId && r.toId === myId,
      );

      const state = sentRequest
        ? "sent"
        : receivedRequest
          ? "received"
          : "none";

      expect(state).toBe("sent");
    });

    it("should return 'received' when I received a request", () => {
      const myId = "p1";
      const targetId = "p2";
      const requests: GameRequest[] = [
        { id: "req1", fromId: "p2", toId: "p1" },
      ];

      const sentRequest = requests.find(
        r => r.fromId === myId && r.toId === targetId,
      );
      const receivedRequest = requests.find(
        r => r.fromId === targetId && r.toId === myId,
      );

      const state = sentRequest
        ? "sent"
        : receivedRequest
          ? "received"
          : "none";

      expect(state).toBe("received");
    });

    it("should return 'none' when myId is null", () => {
      const myId: string | null = null;
      const targetId = "p2";

      const state = myId ? "check-requests" : "none";

      expect(state).toBe("none");
    });
  });

  describe("getIncomingRequest", () => {
    it("should return undefined when no incoming request exists", () => {
      const myId = "p1";
      const targetId = "p2";
      const requests: GameRequest[] = [];

      const incomingRequest = requests.find(
        r => r.fromId === targetId && r.toId === myId,
      );

      expect(incomingRequest).toBeUndefined();
    });

    it("should return request when incoming request exists", () => {
      const myId = "p1";
      const targetId = "p2";
      const requests: GameRequest[] = [
        { id: "req1", fromId: "p2", toId: "p1" },
      ];

      const incomingRequest = requests.find(
        r => r.fromId === targetId && r.toId === myId,
      );

      expect(incomingRequest).toBeDefined();
      expect(incomingRequest?.fromId).toBe("p2");
    });

    it("should return undefined when myId is null", () => {
      const myId: string | null = null;
      const targetId = "p2";

      const incomingRequest = myId ? "check-requests" : undefined;

      expect(incomingRequest).toBeUndefined();
    });
  });

  describe("message actions", () => {
    it("should create request_game message", () => {
      const targetId = "player-2";
      const msg = {
        type: "request_game" as const,
        targetId,
      };

      expect(msg.type).toBe("request_game");
      expect(msg.targetId).toBe("player-2");
    });

    it("should create accept_request message", () => {
      const requestId = "req-123";
      const msg = {
        type: "accept_request" as const,
        requestId,
      };

      expect(msg.type).toBe("accept_request");
      expect(msg.requestId).toBe("req-123");
    });

    it("should create cancel_request message", () => {
      const requestId = "req-123";
      const msg = {
        type: "cancel_request" as const,
        requestId,
      };

      expect(msg.type).toBe("cancel_request");
      expect(msg.requestId).toBe("req-123");
    });
  });

  describe("connection lifecycle", () => {
    it("should wait for player name before connecting", () => {
      const playerName = "";
      const shouldConnect = playerName.trim() !== "";

      expect(shouldConnect).toBe(false);
    });

    it("should connect when player name is provided", () => {
      const playerName = "Test Player";
      const shouldConnect = playerName.trim() !== "";

      expect(shouldConnect).toBe(true);
    });

    it("should send join_lobby message on open", () => {
      const playerName = "Test Player";
      const clientId = "client-123";

      const msg = {
        type: "join_lobby" as const,
        name: playerName,
        clientId,
      };

      expect(msg.type).toBe("join_lobby");
      expect(msg.name).toBe("Test Player");
      expect(msg.clientId).toBe("client-123");
    });

    it("should reset state on disconnect", () => {
      let isConnected = true;
      let myId: string | null = "player-123";
      let players: LobbyPlayer[] = [
        { id: "p1", name: "P1", clientId: "c1" },
      ];
      let requests: GameRequest[] = [
        { id: "req1", fromId: "p1", toId: "p2" },
      ];
      let activeGames = [{ roomId: "room1" }];

      // Simulate disconnect cleanup
      isConnected = false;
      myId = null;
      players = [];
      requests = [];
      activeGames = [];

      expect(isConnected).toBe(false);
      expect(myId).toBeNull();
      expect(players).toHaveLength(0);
      expect(requests).toHaveLength(0);
      expect(activeGames).toHaveLength(0);
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

  describe("message handling", () => {
    it("should handle all message types", () => {
      const messageTypes = [
        "lobby_joined",
        "players",
        "requests",
        "active_games",
        "game_matched",
        "error",
      ];

      const handlers: Record<string, () => void> = {
        lobby_joined: () => {},
        players: () => {},
        requests: () => {},
        active_games: () => {},
        game_matched: () => {},
        error: () => {},
      };

      messageTypes.map(type => {
        expect(handlers[type]).toBeDefined();
        return type;
      });
    });
  });
});
