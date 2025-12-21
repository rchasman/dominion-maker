import { describe, it, expect } from "bun:test";
import type {
  PlayerId,
  PlayerInfo,
  LobbyPlayer,
  GameRequest,
  ActiveGame,
  LobbyClientMessage,
  LobbyServerMessage,
  GameUpdateMessage,
  ChatMessageData,
  GameClientMessage,
  GameServerMessage,
} from "./protocol";

/**
 * Protocol Type Tests
 *
 * Tests type definitions and discriminated unions for type safety.
 */

describe("Protocol Types", () => {
  describe("PlayerId", () => {
    it("should be a string type", () => {
      const playerId: PlayerId = "player-123";
      expect(typeof playerId).toBe("string");
    });
  });

  describe("PlayerInfo", () => {
    it("should have name and playerId properties", () => {
      const playerInfo: PlayerInfo = {
        name: "Test Player",
        playerId: "player-123",
      };
      expect(playerInfo.name).toBe("Test Player");
      expect(playerInfo.playerId).toBe("player-123");
    });
  });

  describe("LobbyPlayer", () => {
    it("should have id, name, and clientId properties", () => {
      const lobbyPlayer: LobbyPlayer = {
        id: "conn-123",
        name: "Test Player",
        clientId: "client-123",
      };
      expect(lobbyPlayer.id).toBe("conn-123");
      expect(lobbyPlayer.name).toBe("Test Player");
      expect(lobbyPlayer.clientId).toBe("client-123");
    });
  });

  describe("GameRequest", () => {
    it("should have id, fromId, and toId properties", () => {
      const request: GameRequest = {
        id: "req-123",
        fromId: "player-1",
        toId: "player-2",
      };
      expect(request.id).toBe("req-123");
      expect(request.fromId).toBe("player-1");
      expect(request.toId).toBe("player-2");
    });
  });

  describe("ActiveGame", () => {
    it("should have roomId, players, spectatorCount, and isSinglePlayer", () => {
      const activeGame: ActiveGame = {
        roomId: "room-123",
        players: [
          { name: "Player 1", isBot: false, id: "p1", isConnected: true },
          { name: "AI", isBot: true, id: "p2", isConnected: true },
        ],
        spectatorCount: 2,
        isSinglePlayer: true,
      };
      expect(activeGame.roomId).toBe("room-123");
      expect(activeGame.players).toHaveLength(2);
      expect(activeGame.spectatorCount).toBe(2);
      expect(activeGame.isSinglePlayer).toBe(true);
    });
  });

  describe("LobbyClientMessage", () => {
    it("should accept join_lobby message", () => {
      const msg: LobbyClientMessage = {
        type: "join_lobby",
        name: "Player",
        clientId: "client-123",
      };
      expect(msg.type).toBe("join_lobby");
    });

    it("should accept request_game message", () => {
      const msg: LobbyClientMessage = {
        type: "request_game",
        targetId: "player-123",
      };
      expect(msg.type).toBe("request_game");
    });

    it("should accept accept_request message", () => {
      const msg: LobbyClientMessage = {
        type: "accept_request",
        requestId: "req-123",
      };
      expect(msg.type).toBe("accept_request");
    });

    it("should accept cancel_request message", () => {
      const msg: LobbyClientMessage = {
        type: "cancel_request",
        requestId: "req-123",
      };
      expect(msg.type).toBe("cancel_request");
    });
  });

  describe("LobbyServerMessage", () => {
    it("should accept lobby_joined message", () => {
      const msg: LobbyServerMessage = {
        type: "lobby_joined",
        playerId: "player-123",
      };
      expect(msg.type).toBe("lobby_joined");
    });

    it("should accept players message", () => {
      const msg: LobbyServerMessage = {
        type: "players",
        players: [],
      };
      expect(msg.type).toBe("players");
    });

    it("should accept requests message", () => {
      const msg: LobbyServerMessage = {
        type: "requests",
        requests: [],
      };
      expect(msg.type).toBe("requests");
    });

    it("should accept active_games message", () => {
      const msg: LobbyServerMessage = {
        type: "active_games",
        games: [],
      };
      expect(msg.type).toBe("active_games");
    });

    it("should accept game_matched message", () => {
      const msg: LobbyServerMessage = {
        type: "game_matched",
        roomId: "room-123",
        opponentName: "Opponent",
      };
      expect(msg.type).toBe("game_matched");
    });

    it("should accept error message", () => {
      const msg: LobbyServerMessage = {
        type: "error",
        message: "Something went wrong",
      };
      expect(msg.type).toBe("error");
    });
  });

  describe("GameUpdateMessage", () => {
    it("should have all required properties", () => {
      const msg: GameUpdateMessage = {
        type: "game_update",
        roomId: "room-123",
        players: [{ name: "Player", isBot: false, isConnected: true }],
        spectatorCount: 1,
        isActive: true,
        isSinglePlayer: false,
      };
      expect(msg.type).toBe("game_update");
      expect(msg.roomId).toBe("room-123");
      expect(msg.isActive).toBe(true);
    });
  });

  describe("ChatMessageData", () => {
    it("should have id, senderName, content, and timestamp", () => {
      const msg: ChatMessageData = {
        id: "msg-123",
        senderName: "Player",
        content: "Hello!",
        timestamp: Date.now(),
      };
      expect(msg.id).toBe("msg-123");
      expect(msg.senderName).toBe("Player");
      expect(msg.content).toBe("Hello!");
      expect(typeof msg.timestamp).toBe("number");
    });
  });

  describe("GameClientMessage", () => {
    it("should accept join message", () => {
      const msg: GameClientMessage = {
        type: "join",
        name: "Player",
      };
      expect(msg.type).toBe("join");
    });

    it("should accept join message with clientId", () => {
      const msg: GameClientMessage = {
        type: "join",
        name: "Player",
        clientId: "client-123",
      };
      expect(msg.type).toBe("join");
      expect(msg.clientId).toBe("client-123");
    });

    it("should accept spectate message", () => {
      const msg: GameClientMessage = {
        type: "spectate",
        name: "Spectator",
      };
      expect(msg.type).toBe("spectate");
    });

    it("should accept start_game message", () => {
      const msg: GameClientMessage = {
        type: "start_game",
      };
      expect(msg.type).toBe("start_game");
    });

    it("should accept start_singleplayer message", () => {
      const msg: GameClientMessage = {
        type: "start_singleplayer",
      };
      expect(msg.type).toBe("start_singleplayer");
    });

    it("should accept change_game_mode message", () => {
      const msg: GameClientMessage = {
        type: "change_game_mode",
        gameMode: "engine",
      };
      expect(msg.type).toBe("change_game_mode");
    });

    it("should accept play_action message", () => {
      const msg: GameClientMessage = {
        type: "play_action",
        card: "Village",
      };
      expect(msg.type).toBe("play_action");
    });

    it("should accept play_treasure message", () => {
      const msg: GameClientMessage = {
        type: "play_treasure",
        card: "Copper",
      };
      expect(msg.type).toBe("play_treasure");
    });

    it("should accept play_all_treasures message", () => {
      const msg: GameClientMessage = {
        type: "play_all_treasures",
      };
      expect(msg.type).toBe("play_all_treasures");
    });

    it("should accept buy_card message", () => {
      const msg: GameClientMessage = {
        type: "buy_card",
        card: "Silver",
      };
      expect(msg.type).toBe("buy_card");
    });

    it("should accept end_phase message", () => {
      const msg: GameClientMessage = {
        type: "end_phase",
      };
      expect(msg.type).toBe("end_phase");
    });

    it("should accept submit_decision message", () => {
      const msg: GameClientMessage = {
        type: "submit_decision",
        choice: { type: "cards", cards: ["Copper"] },
      };
      expect(msg.type).toBe("submit_decision");
    });

    it("should accept request_undo message", () => {
      const msg: GameClientMessage = {
        type: "request_undo",
        toEventId: "event-123",
      };
      expect(msg.type).toBe("request_undo");
    });

    it("should accept approve_undo message", () => {
      const msg: GameClientMessage = {
        type: "approve_undo",
        requestId: "req-123",
      };
      expect(msg.type).toBe("approve_undo");
    });

    it("should accept deny_undo message", () => {
      const msg: GameClientMessage = {
        type: "deny_undo",
        requestId: "req-123",
      };
      expect(msg.type).toBe("deny_undo");
    });

    it("should accept resign message", () => {
      const msg: GameClientMessage = {
        type: "resign",
      };
      expect(msg.type).toBe("resign");
    });

    it("should accept leave message", () => {
      const msg: GameClientMessage = {
        type: "leave",
      };
      expect(msg.type).toBe("leave");
    });

    it("should accept chat message", () => {
      const msg: GameClientMessage = {
        type: "chat",
        message: {
          id: "msg-123",
          senderName: "Player",
          content: "Hello",
          timestamp: Date.now(),
        },
      };
      expect(msg.type).toBe("chat");
    });
  });

  describe("GameServerMessage", () => {
    it("should accept joined message", () => {
      const msg: GameServerMessage = {
        type: "joined",
        playerId: "player-123",
        isSpectator: false,
        isHost: true,
      };
      expect(msg.type).toBe("joined");
    });

    it("should accept player_list message", () => {
      const msg: GameServerMessage = {
        type: "player_list",
        players: [{ name: "Player", playerId: "p1" }],
      };
      expect(msg.type).toBe("player_list");
    });

    it("should accept spectator_count message", () => {
      const msg: GameServerMessage = {
        type: "spectator_count",
        count: 3,
      };
      expect(msg.type).toBe("spectator_count");
    });

    it("should accept game_started message", () => {
      const msg: GameServerMessage = {
        type: "game_started",
        state: {} as any,
        events: [],
      };
      expect(msg.type).toBe("game_started");
    });

    it("should accept events message", () => {
      const msg: GameServerMessage = {
        type: "events",
        events: [],
        state: {} as any,
      };
      expect(msg.type).toBe("events");
    });

    it("should accept full_state message", () => {
      const msg: GameServerMessage = {
        type: "full_state",
        state: {} as any,
        events: [],
      };
      expect(msg.type).toBe("full_state");
    });

    it("should accept player_resigned message", () => {
      const msg: GameServerMessage = {
        type: "player_resigned",
        playerName: "Player",
      };
      expect(msg.type).toBe("player_resigned");
    });

    it("should accept player_disconnected message", () => {
      const msg: GameServerMessage = {
        type: "player_disconnected",
        playerName: "Player",
        playerId: "p1",
      };
      expect(msg.type).toBe("player_disconnected");
    });

    it("should accept player_reconnected message", () => {
      const msg: GameServerMessage = {
        type: "player_reconnected",
        playerName: "Player",
        playerId: "p1",
      };
      expect(msg.type).toBe("player_reconnected");
    });

    it("should accept error message", () => {
      const msg: GameServerMessage = {
        type: "error",
        message: "Error occurred",
      };
      expect(msg.type).toBe("error");
    });

    it("should accept game_ended message", () => {
      const msg: GameServerMessage = {
        type: "game_ended",
        reason: "Player resigned",
      };
      expect(msg.type).toBe("game_ended");
    });

    it("should accept chat message", () => {
      const msg: GameServerMessage = {
        type: "chat",
        message: {
          id: "msg-123",
          senderName: "Player",
          content: "Hello",
          timestamp: Date.now(),
        },
      };
      expect(msg.type).toBe("chat");
    });

    it("should accept chat_history message", () => {
      const msg: GameServerMessage = {
        type: "chat_history",
        messages: [],
      };
      expect(msg.type).toBe("chat_history");
    });
  });
});
