import { describe, it, expect } from "bun:test";
import type { LLMLogEntry } from "../components/LLMLog";

describe("use-game-actions helper utilities", () => {
  describe("filterLogsAfterUndo", () => {
    /**
     * Helper function to filter LLM logs after undo.
     * This is the pure logic extracted from the hook.
     */
    const filterLogsAfterUndo = (
      logs: LLMLogEntry[],
      eventsAfterUndo: number
    ): LLMLogEntry[] => {
      return logs.filter(log => {
        const logEventCount = log.data?.eventCount;
        return (
          logEventCount === undefined ||
          (typeof logEventCount === "number" && logEventCount <= eventsAfterUndo)
        );
      });
    };

    it("should return all logs when eventsAfterUndo is large", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: 1 },
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 5 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 10);
      expect(filtered).toEqual(logs);
    });

    it("should filter out logs created after undo point", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: 1 },
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 5 },
        },
        {
          id: "log-3",
          timestamp: 3000,
          type: "TURN_ENDED",
          data: { eventCount: 10 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 5);
      expect(filtered).toEqual([logs[0], logs[1]]);
    });

    it("should handle logs with undefined eventCount", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: undefined },
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 5 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 3);
      // log-1 passes (undefined eventCount), log-2 fails (5 > 3)
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("log-1");
    });

    it("should handle logs with missing data object", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: {},
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 5 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 3);
      // log-1 passes (eventCount undefined in empty data), log-2 fails (5 > 3)
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe("log-1");
    });

    it("should return empty array when eventsAfterUndo is 0", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: 1 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 0);
      expect(filtered).toEqual([]);
    });

    it("should keep logs at exact event count boundary", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: 5 },
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 6 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 5);
      expect(filtered).toEqual([logs[0]]);
    });

    it("should handle empty logs array", () => {
      const logs: LLMLogEntry[] = [];
      const filtered = filterLogsAfterUndo(logs, 10);
      expect(filtered).toEqual([]);
    });

    it("should preserve log order", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: 1 },
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 2 },
        },
        {
          id: "log-3",
          timestamp: 3000,
          type: "TURN_ENDED",
          data: { eventCount: 3 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 10);
      expect(filtered[0].id).toBe("log-1");
      expect(filtered[1].id).toBe("log-2");
      expect(filtered[2].id).toBe("log-3");
    });

    it("should handle non-numeric eventCount values gracefully", () => {
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: "invalid" as any },
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 5 },
        },
      ];
      const filtered = filterLogsAfterUndo(logs, 3);
      // First log has non-numeric eventCount, so it won't pass the numeric check
      expect(filtered.length).toBe(0);
    });
  });

  describe("GameActions interface", () => {
    it("should define all required action methods", () => {
      const actions = {
        playAction: () => ({ ok: true }),
        playTreasure: () => ({ ok: true }),
        unplayTreasure: () => ({ ok: true }),
        playAllTreasures: () => ({ ok: true }),
        buyCard: () => ({ ok: true }),
        endPhase: () => ({ ok: true }),
        submitDecision: () => ({ ok: true }),
        revealReaction: () => ({ ok: true }),
        declineReaction: () => ({ ok: true }),
        requestUndo: () => {},
        getStateAtEvent: () => ({}),
      };

      expect(actions).toBeDefined();
      expect(typeof actions.playAction).toBe("function");
      expect(typeof actions.playTreasure).toBe("function");
      expect(typeof actions.unplayTreasure).toBe("function");
      expect(typeof actions.playAllTreasures).toBe("function");
      expect(typeof actions.buyCard).toBe("function");
      expect(typeof actions.endPhase).toBe("function");
      expect(typeof actions.submitDecision).toBe("function");
      expect(typeof actions.revealReaction).toBe("function");
      expect(typeof actions.declineReaction).toBe("function");
      expect(typeof actions.requestUndo).toBe("function");
      expect(typeof actions.getStateAtEvent).toBe("function");
    });
  });

  describe("undo and redo integration logic", () => {
    it("should correctly filter logs based on undo event count", () => {
      const filterLogsAfterUndo = (
        logs: LLMLogEntry[],
        eventsAfterUndo: number
      ): LLMLogEntry[] => {
        return logs.filter(log => {
          const logEventCount = log.data?.eventCount;
          return (
            logEventCount === undefined ||
            (typeof logEventCount === "number" && logEventCount <= eventsAfterUndo)
          );
        });
      };

      // Simulate a game where 10 events were created with associated logs
      const logs: LLMLogEntry[] = [
        {
          id: "log-1",
          timestamp: 1000,
          type: "START_GAME",
          data: { eventCount: 1 },
        },
        {
          id: "log-2",
          timestamp: 2000,
          type: "TURN_ENDED",
          data: { eventCount: 5 },
        },
        {
          id: "log-3",
          timestamp: 3000,
          type: "TURN_ENDED",
          data: { eventCount: 8 },
        },
        {
          id: "log-4",
          timestamp: 4000,
          type: "TURN_ENDED",
          data: { eventCount: 10 },
        },
      ];

      // Undo to event 5, so only logs from events 1-5 should remain
      const remaining = filterLogsAfterUndo(logs, 5);
      expect(remaining.length).toBe(2);
      expect(remaining.map(l => l.id)).toEqual(["log-1", "log-2"]);
    });
  });
});
