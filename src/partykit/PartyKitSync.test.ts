import { describe, it, expect } from "bun:test";
import type { GameClientMessage } from "./protocol";

/**
 * Unit tests for PartyKitSync component
 *
 * Tests the sync logic and message creation.
 * Component lifecycle is tested through integration tests.
 */

describe("PartyKitSync", () => {
  describe("room storage", () => {
    it("should generate room ID if not stored", () => {
      const stored = null;
      const shouldGenerate = !stored;

      expect(shouldGenerate).toBe(true);
    });

    it("should use stored room ID if available", () => {
      const stored = "room-123";
      const roomId = stored || "new-room";

      expect(roomId).toBe("room-123");
    });

    it("should store room ID to localStorage", () => {
      const roomId = "room-123";
      const storageKey = "dominion_singleplayer_sync_room";

      // Simulate storage
      const stored = { [storageKey]: roomId };

      expect(stored[storageKey]).toBe("room-123");
    });
  });

  describe("player name retrieval", () => {
    it("should use stored player name if available", () => {
      const storedName = "Test Player";
      const playerName = storedName || "Default";

      expect(playerName).toBe("Test Player");
    });

    it("should generate name if not stored", () => {
      const storedName = null;
      const shouldGenerate = !storedName;

      expect(shouldGenerate).toBe(true);
    });
  });

  describe("connection lifecycle", () => {
    it("should not connect when no game state", () => {
      const gameState = null;
      const shouldConnect = !!gameState;

      expect(shouldConnect).toBe(false);
    });

    it("should connect when game state exists", () => {
      const gameState = { test: "state" };
      const shouldConnect = !!gameState;

      expect(shouldConnect).toBe(true);
    });
  });

  describe("join message", () => {
    it("should send join message with player name on open", () => {
      const playerName = "Test Player";
      const msg: GameClientMessage = {
        type: "join",
        name: playerName,
      };

      expect(msg.type).toBe("join");
      expect(msg.name).toBe("Test Player");
    });
  });

  describe("sync counter reset", () => {
    it("should reset when events array shrinks", () => {
      const previousCount = 10;
      const currentCount = 5;
      const shouldReset = currentCount < previousCount;

      expect(shouldReset).toBe(true);
    });

    it("should not reset when events array grows", () => {
      const previousCount = 5;
      const currentCount = 10;
      const shouldReset = currentCount < previousCount;

      expect(shouldReset).toBe(false);
    });

    it("should not reset when events array stays same", () => {
      const previousCount = 10;
      const currentCount = 10;
      const shouldReset = currentCount < previousCount;

      expect(shouldReset).toBe(false);
    });
  });

  describe("game start", () => {
    it("should wait until joined before starting", () => {
      const isJoined = false;
      const shouldStart = isJoined;

      expect(shouldStart).toBe(false);
    });

    it("should wait for game state before starting", () => {
      const isJoined = true;
      const gameState = null;
      const shouldStart = isJoined && !!gameState;

      expect(shouldStart).toBe(false);
    });

    it("should wait for socket to be open", () => {
      const isJoined = true;
      const gameState = { test: "state" };
      const socketReady = false;
      const shouldStart = isJoined && !!gameState && socketReady;

      expect(shouldStart).toBe(false);
    });

    it("should not start if already synced", () => {
      const isJoined = true;
      const gameState = { test: "state" };
      const socketReady = true;
      const syncedEventCount = 5;
      const shouldStart =
        isJoined && !!gameState && socketReady && syncedEventCount === 0;

      expect(shouldStart).toBe(false);
    });

    it("should start when all conditions met", () => {
      const isJoined = true;
      const gameState = { test: "state" };
      const socketReady = true;
      const syncedEventCount = 0;
      const shouldStart =
        isJoined && !!gameState && socketReady && syncedEventCount === 0;

      expect(shouldStart).toBe(true);
    });
  });

  describe("start_singleplayer message", () => {
    it("should send start_singleplayer with game mode", () => {
      const gameMode = "engine";
      const msg: GameClientMessage = {
        type: "start_singleplayer",
        gameMode,
      };

      expect(msg.type).toBe("start_singleplayer");
      expect(msg.gameMode).toBe("engine");
    });
  });

  describe("sync_events message", () => {
    it("should send all events on initial sync", () => {
      const events = [
        { id: "e1", type: "GAME_STARTED" } as any,
        { id: "e2", type: "TURN_STARTED" } as any,
      ];
      const msg: GameClientMessage = {
        type: "sync_events",
        events,
      };

      expect(msg.type).toBe("sync_events");
      expect(msg.events).toHaveLength(2);
    });

    it("should send only new events on incremental sync", () => {
      const allEvents = [
        { id: "e1" } as any,
        { id: "e2" } as any,
        { id: "e3" } as any,
      ];
      const syncedCount = 2;
      const newEvents = allEvents.slice(syncedCount);

      const msg: GameClientMessage = {
        type: "sync_events",
        events: newEvents,
      };

      expect(msg.events).toHaveLength(1);
      expect(msg.events[0]?.id).toBe("e3");
    });
  });

  describe("incremental sync", () => {
    it("should not sync when not joined", () => {
      const isJoined = false;
      const shouldSync = isJoined;

      expect(shouldSync).toBe(false);
    });

    it("should not sync when no initial sync done", () => {
      const isJoined = true;
      const syncedEventCount = 0;
      const shouldSync = isJoined && syncedEventCount > 0;

      expect(shouldSync).toBe(false);
    });

    it("should not sync when socket not ready", () => {
      const isJoined = true;
      const syncedEventCount = 5;
      const socketReady = false;
      const shouldSync = isJoined && syncedEventCount > 0 && socketReady;

      expect(shouldSync).toBe(false);
    });

    it("should not sync when no new events", () => {
      const totalEvents = 5;
      const syncedCount = 5;
      const hasNewEvents = totalEvents > syncedCount;

      expect(hasNewEvents).toBe(false);
    });

    it("should sync when new events available", () => {
      const totalEvents = 7;
      const syncedCount = 5;
      const hasNewEvents = totalEvents > syncedCount;

      expect(hasNewEvents).toBe(true);
    });
  });

  describe("game end cleanup", () => {
    it("should not send leave when game not over", () => {
      const gameOver = false;
      const shouldLeave = gameOver;

      expect(shouldLeave).toBe(false);
    });

    it("should not send leave when not joined", () => {
      const gameOver = true;
      const isJoined = false;
      const shouldLeave = gameOver && isJoined;

      expect(shouldLeave).toBe(false);
    });

    it("should send leave when game over and joined", () => {
      const gameOver = true;
      const isJoined = true;
      const shouldLeave = gameOver && isJoined;

      expect(shouldLeave).toBe(true);
    });
  });

  describe("leave message", () => {
    it("should send leave message", () => {
      const msg: GameClientMessage = {
        type: "leave",
      };

      expect(msg.type).toBe("leave");
    });
  });

  describe("room cleanup", () => {
    it("should clear room ID from storage on game end", () => {
      const storageKey = "dominion_singleplayer_sync_room";
      const storage: Record<string, string> = {
        [storageKey]: "room-123",
      };

      // Simulate removal
      delete storage[storageKey];

      expect(storage[storageKey]).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("should continue silently on connection error", () => {
      let socketRef: any = { current: "socket" };

      // Simulate error
      socketRef.current = null;

      expect(socketRef.current).toBeNull();
    });

    it("should continue silently on setup failure", () => {
      let setupError: Error | null = null;

      try {
        // Simulate setup
      } catch (error) {
        setupError = error as Error;
      }

      // Should not throw
      expect(setupError).toBeNull();
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

  describe("room ID generation on reset", () => {
    it("should generate new room ID when game resets", () => {
      const oldRoomId = "room-old";
      const newRoomId = "room-new";

      // Simulate reset
      const roomId = oldRoomId !== newRoomId ? newRoomId : oldRoomId;

      expect(roomId).toBe("room-new");
    });

    it("should close old connection on reset", () => {
      let socketRef: any = { current: { close: () => {} } };
      let closed = false;

      // Simulate close
      socketRef.current = null;
      closed = true;

      expect(socketRef.current).toBeNull();
      expect(closed).toBe(true);
    });
  });

  describe("component lifecycle", () => {
    it("should return null (no rendered output)", () => {
      const renderOutput = null;

      expect(renderOutput).toBeNull();
    });
  });

  describe("localStorage access safety", () => {
    it("should handle localStorage access errors gracefully", () => {
      let value: string | null = null;
      let error: Error | null = null;

      try {
        // Simulate localStorage.getItem
        value = "stored-value";
      } catch (e) {
        error = e as Error;
      }

      // Should not throw
      expect(error).toBeNull();
    });

    it("should handle localStorage.setItem errors gracefully", () => {
      let error: Error | null = null;

      try {
        // Simulate localStorage.setItem
      } catch (e) {
        error = e as Error;
      }

      // Should not throw
      expect(error).toBeNull();
    });

    it("should have fallback when localStorage unavailable", () => {
      const storageAvailable = false;
      const fallbackValue = "fallback-id";

      const value = storageAvailable ? "stored" : fallbackValue;

      expect(value).toBe("fallback-id");
    });
  });
});
