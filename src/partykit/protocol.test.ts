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
import type { PlayerInfoEntry } from "../types/player-info";
import {
  consensusLogEntrySchema,
  gameMessageSchema,
  lobbyMessageSchema,
} from "../validation/messages";

/**
 * Protocol Type Tests
 *
 * Tests type definitions and discriminated unions for type safety.
 */

const stampedEntry = {
  id: "log-1",
  timestamp: 1_700_000_000_000,
  type: "consensus-voting",
  message: "◉ Voting: winner e4 (3/5)",
  data: { playerId: "w", votingDuration: 900 },
};

describe("Protocol Types", () => {
  describe("consensus_log", () => {
    it("carries one stamped log entry to a connection", () => {
      const message: GameServerMessage = {
        type: "consensus_log",
        entry: {
          id: "log-1",
          timestamp: 1_700_000_000_000,
          type: "consensus-voting",
          message: "◉ Voting: winner e4 (3/5)",
          data: { playerId: "w" },
        },
      };
      expect(message.type).toBe("consensus_log");
    });

    it("accepts a stamped entry", () => {
      expect(consensusLogEntrySchema.safeParse(stampedEntry).success).toBe(
        true,
      );
    });

    it("refuses an entry that is unstamped, unknown or padded", () => {
      const { timestamp, ...unstamped } = stampedEntry;
      expect(timestamp).toBeGreaterThan(0);
      expect(consensusLogEntrySchema.safeParse(unstamped).success).toBe(false);
      expect(
        consensusLogEntrySchema.safeParse({ ...stampedEntry, type: "gossip" })
          .success,
      ).toBe(false);
      expect(
        consensusLogEntrySchema.safeParse({ ...stampedEntry, children: [] })
          .success,
      ).toBe(false);
    });
  });

  describe("PlayerId", () => {
    it("should be a string type", () => {
      const playerId: PlayerId = "player-123";
      expect(typeof playerId).toBe("string");
    });
  });

  describe("PlayerInfo", () => {
    it("carries the seat kind shown in the player list", () => {
      const playerInfo: PlayerInfo = {
        name: "Test Player",
        playerId: "player-123",
        controller: "human",
      };
      expect(playerInfo.name).toBe("Test Player");
      expect(playerInfo.playerId).toBe("player-123");
    });
  });

  describe("PlayerInfoEntry", () => {
    it("carries id, name, type and connection state", () => {
      const entry: PlayerInfoEntry = {
        id: "player-123",
        name: "Test Player",
        type: "human",
        connected: true,
      };
      expect(entry.id).toBe("player-123");
      expect(entry.type).toBe("human");
      expect(entry.connected).toBe(true);
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
    it("names the game it was made for", () => {
      const request: GameRequest = {
        id: "req-123",
        fromId: "player-1",
        toId: "player-2",
        game: "dominion",
      };
      expect(request.id).toBe("req-123");
      expect(request.fromId).toBe("player-1");
      expect(request.toId).toBe("player-2");
      expect(request.game).toBe("dominion");
    });
  });

  describe("ActiveGame", () => {
    it("names the game the room is playing", () => {
      const activeGame: ActiveGame = {
        roomId: "room-123",
        game: "dominion",
        players: [
          { name: "Player 1", isBot: false, id: "p1", isConnected: true },
          { name: "AI", isBot: true, id: "p2", isConnected: true },
        ],
        spectatorCount: 2,
        isSinglePlayer: true,
      };
      expect(activeGame.roomId).toBe("room-123");
      expect(activeGame.game).toBe("dominion");
      expect(activeGame.players).toHaveLength(2);
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

    it("request_game names the game being requested", () => {
      const msg: LobbyClientMessage = {
        type: "request_game",
        targetId: "player-123",
        game: "dominion",
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
      const msg: LobbyServerMessage = { type: "players", players: [] };
      expect(msg.type).toBe("players");
    });

    it("should accept requests message", () => {
      const msg: LobbyServerMessage = { type: "requests", requests: [] };
      expect(msg.type).toBe("requests");
    });

    it("should accept active_games message", () => {
      const msg: LobbyServerMessage = { type: "active_games", games: [] };
      expect(msg.type).toBe("active_games");
    });

    it("game_matched returns the game both clients join with", () => {
      const msg: LobbyServerMessage = {
        type: "game_matched",
        roomId: "room-123",
        opponentName: "Opponent",
        game: "dominion",
      };
      expect(msg.type).toBe("game_matched");
      if (msg.type === "game_matched") expect(msg.game).toBe("dominion");
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
    it("carries the room's game alongside the roster", () => {
      const msg: GameUpdateMessage = {
        type: "game_update",
        roomId: "room-123",
        game: "dominion",
        players: [{ name: "Player", isBot: false, isConnected: true }],
        spectatorCount: 1,
        isActive: true,
        isSinglePlayer: false,
      };
      expect(msg.game).toBe("dominion");
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
      expect(typeof msg.timestamp).toBe("number");
    });
  });

  describe("GameClientMessage", () => {
    it("join names the game the room plays", () => {
      const msg: GameClientMessage = {
        type: "join",
        name: "Player",
        game: "dominion",
      };
      expect(msg.type).toBe("join");
      if (msg.type === "join") expect(msg.game).toBe("dominion");
    });

    it("spectate names the game so a mismatch can be refused", () => {
      const msg: GameClientMessage = {
        type: "spectate",
        name: "Spectator",
        game: "dominion",
      };
      expect(msg.type).toBe("spectate");
    });

    it("start_game carries opaque options", () => {
      const msg: GameClientMessage = {
        type: "start_game",
        options: { kingdomCards: ["Village"] },
      };
      expect(msg.type).toBe("start_game");
    });

    it("start_singleplayer carries seats and opaque options", () => {
      const msg: GameClientMessage = {
        type: "start_singleplayer",
        seats: { human: { kind: "human" } },
        options: { kingdomCards: ["Village"] },
      };
      expect(msg.type).toBe("start_singleplayer");
      if (msg.type === "start_singleplayer") {
        expect(msg.options).toEqual({ kingdomCards: ["Village"] });
      }
    });

    it("should accept start_game with bot seats", () => {
      const msg: GameClientMessage = {
        type: "start_game",
        bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
      };
      expect(msg.type).toBe("start_game");
    });

    it("should accept set_seat message", () => {
      const msg: GameClientMessage = {
        type: "set_seat",
        playerId: "p1",
        controller: { kind: "heuristic" },
      };
      expect(msg.type).toBe("set_seat");
    });

    it("command carries an opaque payload the room's module validates", () => {
      const msg: GameClientMessage = {
        type: "command",
        command: { type: "PLAY_ACTION", card: "Village" },
      };
      expect(msg.type).toBe("command");
    });

    it("should accept resign message", () => {
      const msg: GameClientMessage = { type: "resign" };
      expect(msg.type).toBe("resign");
    });

    it("should accept leave message", () => {
      const msg: GameClientMessage = { type: "leave" };
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
        players: [{ name: "Player", playerId: "p1", controller: "human" }],
      };
      expect(msg.type).toBe("player_list");
    });

    it("should accept spectator_count message", () => {
      const msg: GameServerMessage = { type: "spectator_count", count: 3 };
      expect(msg.type).toBe("spectator_count");
    });

    it("game_started carries game, opaque state and playerInfo", () => {
      const msg: GameServerMessage = {
        type: "game_started",
        game: "dominion",
        state: { turn: 1 },
        events: [],
        playerInfo: {
          p1: { id: "p1", name: "Player", type: "human", connected: true },
        },
      };
      expect(msg.type).toBe("game_started");
    });

    it("events carries game, opaque state and playerInfo", () => {
      const msg: GameServerMessage = {
        type: "events",
        game: "dominion",
        events: [{ type: "TURN_STARTED" }],
        state: { turn: 2 },
        playerInfo: {
          p1: { id: "p1", name: "Player", type: "human", connected: true },
          p2: { id: "p2", name: "Bot", type: "ai", connected: false },
        },
      };
      expect(msg.type).toBe("events");
      if (msg.type === "events") {
        expect(msg.game).toBe("dominion");
        expect(msg.events).toHaveLength(1);
        expect(msg.playerInfo["p2"]?.type).toBe("ai");
      }
    });

    it("full_state carries game, opaque state and playerInfo", () => {
      const msg: GameServerMessage = {
        type: "full_state",
        game: "dominion",
        state: {},
        events: [],
        playerInfo: {},
      };
      expect(msg.type).toBe("full_state");
    });

    it("preview_state carries game, opaque state and playerInfo", () => {
      const msg: GameServerMessage = {
        type: "preview_state",
        game: "dominion",
        eventId: "e1",
        state: null,
        playerInfo: {},
      };
      expect(msg.type).toBe("preview_state");
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
      const msg: GameServerMessage = { type: "chat_history", messages: [] };
      expect(msg.type).toBe("chat_history");
    });
  });
});

const parses = (value: unknown) => gameMessageSchema.safeParse(value).success;

describe("gameMessageSchema", () => {
  it("accepts a command with any payload", () => {
    expect(parses({ type: "command", command: { anything: [1, 2] } })).toBe(
      true,
    );
    expect(parses({ type: "command", command: "END_PHASE" })).toBe(true);
    expect(parses({ type: "command", command: null })).toBe(true);
  });

  it("rejects a stale client's extra top-level fields", () => {
    expect(parses({ type: "start_game", kingdomCards: ["Village"] })).toBe(
      false,
    );
    expect(
      parses({
        type: "start_singleplayer",
        seats: { a: { kind: "human" } },
        kingdomCards: ["Village"],
      }),
    ).toBe(false);
    expect(
      parses({ type: "join", name: "Player", game: "dominion", mode: "full" }),
    ).toBe(false);
    // The two opaque payloads stay opaque
    expect(parses({ type: "start_game", options: { anything: 1 } })).toBe(true);
    expect(parses({ type: "command", command: { anything: 1 } })).toBe(true);
  });

  it("rejects extra fields inside a nested object", () => {
    const message = {
      id: "m1",
      senderName: "Player",
      content: "hi",
      timestamp: 1,
    };
    expect(parses({ type: "chat", message })).toBe(true);
    // handleChat spreads the message, so an unknown key would reach every client
    expect(
      parses({ type: "chat", message: { ...message, script: "<img>" } }),
    ).toBe(false);

    const bot = { name: "Bot", controller: { kind: "heuristic" } };
    expect(parses({ type: "start_game", bots: [bot] })).toBe(true);
    expect(parses({ type: "start_game", bots: [{ ...bot, seat: 2 }] })).toBe(
      false,
    );
    expect(
      parses({
        type: "start_game",
        bots: [{ name: "Bot", controller: { kind: "heuristic", spy: true } }],
      }),
    ).toBe(false);
    expect(
      parses({
        type: "start_singleplayer",
        seats: { a: { kind: "human", spy: true } },
      }),
    ).toBe(false);
  });

  it("rejects the nine Dominion verbs the protocol no longer speaks", () => {
    const retired: unknown[] = [
      { type: "play_action", card: "Village" },
      { type: "play_treasure", card: "Copper" },
      { type: "play_all_treasures" },
      { type: "buy_card", card: "Silver" },
      { type: "end_phase" },
      { type: "submit_decision", choice: { selectedCards: ["Copper"] } },
      { type: "request_undo", toEventId: "e1" },
      { type: "approve_undo", requestId: "r1" },
      { type: "deny_undo", requestId: "r1" },
    ];
    expect(retired.filter(parses)).toEqual([]);
  });

  it("accepts join naming a known game", () => {
    expect(parses({ type: "join", name: "Player", game: "dominion" })).toBe(
      true,
    );
  });

  it("rejects join without a game", () => {
    expect(parses({ type: "join", name: "Player" })).toBe(false);
  });

  it("rejects join naming an unknown game", () => {
    expect(parses({ type: "join", name: "Player", game: "poker" })).toBe(false);
  });

  it("rejects spectate without a game", () => {
    expect(parses({ type: "spectate", name: "Watcher" })).toBe(false);
  });

  it("accepts start_game with and without options", () => {
    expect(parses({ type: "start_game" })).toBe(true);
    expect(parses({ type: "start_game", options: { seed: 7 } })).toBe(true);
    expect(
      parses({
        type: "start_game",
        options: {},
        bots: [{ name: "Bot", controller: { kind: "heuristic" } }],
      }),
    ).toBe(true);
  });

  it("accepts start_singleplayer with and without options", () => {
    const seats = { human: { kind: "human" } };
    expect(parses({ type: "start_singleplayer", seats })).toBe(true);
    expect(
      parses({
        type: "start_singleplayer",
        seats,
        options: { kingdomCards: ["Village"] },
      }),
    ).toBe(true);
  });

  it("accepts preview_state naming an event and rejects it without one", () => {
    expect(parses({ type: "preview_state", eventId: "e1" })).toBe(true);
    expect(parses({ type: "preview_state" })).toBe(false);
  });

  it("accepts sync_events of opaque events up to 20000", () => {
    const events = Array.from({ length: 20000 }, (_, i) => ({ id: `e${i}` }));
    expect(parses({ type: "sync_events", events })).toBe(true);
  });

  it("rejects sync_events over 20000 events", () => {
    const events = Array.from({ length: 20001 }, (_, i) => ({ id: `e${i}` }));
    expect(parses({ type: "sync_events", events })).toBe(false);
  });
});

describe("lobbyMessageSchema", () => {
  it("accepts request_game naming a known game", () => {
    expect(
      lobbyMessageSchema.safeParse({
        type: "request_game",
        targetId: "p2",
        game: "dominion",
      }).success,
    ).toBe(true);
  });

  it("rejects a lobby message carrying an extra field", () => {
    expect(
      lobbyMessageSchema.safeParse({
        type: "accept_request",
        requestId: "r1",
        game: "dominion",
      }).success,
    ).toBe(false);
  });

  it("rejects request_game without a game", () => {
    expect(
      lobbyMessageSchema.safeParse({ type: "request_game", targetId: "p2" })
        .success,
    ).toBe(false);
  });
});
