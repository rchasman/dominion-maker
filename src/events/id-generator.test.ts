import { describe, it, expect, beforeEach } from "bun:test";
import {
  generateEventId,
  resetEventCounter,
  syncEventCounter,
} from "./id-generator";

describe("id-generator", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("generateEventId", () => {
    it("generates sequential event IDs starting from evt-1", () => {
      const id1 = generateEventId();
      const id2 = generateEventId();
      const id3 = generateEventId();

      expect(id1).toBe("evt-1");
      expect(id2).toBe("evt-2");
      expect(id3).toBe("evt-3");
    });

    it("increments counter on each call", () => {
      const ids = Array.from({ length: 10 }).map(() => generateEventId());

      expect(ids).toEqual([
        "evt-1",
        "evt-2",
        "evt-3",
        "evt-4",
        "evt-5",
        "evt-6",
        "evt-7",
        "evt-8",
        "evt-9",
        "evt-10",
      ]);
    });

    it("generates unique IDs within a session", () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateEventId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe("resetEventCounter", () => {
    it("resets counter to 0", () => {
      generateEventId();
      generateEventId();
      generateEventId();

      resetEventCounter();

      const id = generateEventId();
      expect(id).toBe("evt-1");
    });

    it("allows starting fresh after multiple resets", () => {
      generateEventId();
      resetEventCounter();
      generateEventId();
      resetEventCounter();

      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).toBe("evt-1");
      expect(id2).toBe("evt-2");
    });
  });

  describe("syncEventCounter", () => {
    it("syncs counter to highest event ID in array", () => {
      const events = [
        { id: "evt-1" },
        { id: "evt-5" },
        { id: "evt-3" },
        { id: "evt-2" },
      ];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-6");
    });

    it("handles empty event array", () => {
      generateEventId();
      generateEventId();

      syncEventCounter([]);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-1");
    });

    it("handles events without IDs", () => {
      const events = [{ id: "evt-5" }, {}, { id: "evt-3" }, {}];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-6");
    });

    it("ignores events with non-evt- prefixes", () => {
      const events = [
        { id: "evt-5" },
        { id: "custom-100" },
        { id: "evt-3" },
        { id: "other-50" },
      ];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-6");
    });

    it("handles malformed event IDs (NaN)", () => {
      const events = [{ id: "evt-5" }, { id: "evt-abc" }, { id: "evt-3" }];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-6");
    });

    it("handles events with IDs not starting with evt-", () => {
      const events = [{ id: "event-10" }, { id: "e-20" }, { id: "30" }];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-1");
    });

    it("syncs to large event numbers", () => {
      const events = [{ id: "evt-1000" }, { id: "evt-500" }, { id: "evt-2000" }];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-2001");
    });

    it("handles single event", () => {
      const events = [{ id: "evt-42" }];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-43");
    });

    it("handles events with only invalid IDs", () => {
      const events = [
        { id: "custom-1" },
        { id: "test-2" },
        { id: undefined },
      ];

      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-1");
    });

    it("maintains counter after sync and continues incrementing", () => {
      const events = [{ id: "evt-10" }];

      syncEventCounter(events);

      const id1 = generateEventId();
      const id2 = generateEventId();
      const id3 = generateEventId();

      expect(id1).toBe("evt-11");
      expect(id2).toBe("evt-12");
      expect(id3).toBe("evt-13");
    });

    it("allows syncing multiple times", () => {
      syncEventCounter([{ id: "evt-5" }]);
      expect(generateEventId()).toBe("evt-6");

      syncEventCounter([{ id: "evt-10" }]);
      expect(generateEventId()).toBe("evt-11");

      syncEventCounter([{ id: "evt-3" }]);
      expect(generateEventId()).toBe("evt-4");
    });

    it("handles events with trailing characters after number", () => {
      const events = [{ id: "evt-5-extra" }, { id: "evt-3" }];

      syncEventCounter(events);

      const nextId = generateEventId();
      // evt-5-extra: parseInt("5-extra", 10) returns 5 (parses until non-digit)
      // So max is 5, next should be evt-6
      expect(nextId).toBe("evt-6");
    });
  });

  describe("integration scenarios", () => {
    it("handles undo scenario: sync to earlier event", () => {
      generateEventId();
      generateEventId();
      generateEventId();

      const events = [{ id: "evt-1" }, { id: "evt-2" }];
      syncEventCounter(events);

      const nextId = generateEventId();
      expect(nextId).toBe("evt-3");
    });

    it("handles reconnect scenario: sync to server state", () => {
      const serverEvents = [
        { id: "evt-1" },
        { id: "evt-2" },
        { id: "evt-3" },
        { id: "evt-4" },
        { id: "evt-5" },
      ];

      syncEventCounter(serverEvents);

      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).toBe("evt-6");
      expect(id2).toBe("evt-7");
    });

    it("handles new game: reset and start fresh", () => {
      generateEventId();
      generateEventId();

      resetEventCounter();

      const id1 = generateEventId();
      const id2 = generateEventId();

      expect(id1).toBe("evt-1");
      expect(id2).toBe("evt-2");
    });
  });
});
