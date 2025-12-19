import { describe, it, expect, beforeEach } from "bun:test";
import { EventBuilder, linkEvents } from "./event-builder";
import { resetEventCounter } from "./id-generator";
import type { GameEvent } from "./types";

describe("EventBuilder", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  describe("constructor", () => {
    it("creates builder with auto-generated root ID", () => {
      const builder = new EventBuilder();
      const rootId = builder.getRootId();

      expect(rootId).toBe("evt-1");
    });

    it("creates builder with explicit root ID", () => {
      const builder = new EventBuilder("custom-root-id");
      const rootId = builder.getRootId();

      expect(rootId).toBe("custom-root-id");
    });

    it("starts empty", () => {
      const builder = new EventBuilder();

      expect(builder.isEmpty()).toBe(true);
      expect(builder.build()).toEqual([]);
    });
  });

  describe("add", () => {
    it("adds first event as root with no causedBy", () => {
      const builder = new EventBuilder();

      builder.add({
        type: "CARD_PLAYED",
        playerId: "human",
        card: "Village",
        sourceIndex: 0,
      });

      const events = builder.build();

      expect(events.length).toBe(1);
      expect(events[0]!.id).toBe("evt-1");
      expect(events[0]!.causedBy).toBeUndefined();
    });

    it("adds subsequent events with causedBy pointing to root", () => {
      const builder = new EventBuilder();

      builder.add({
        type: "CARD_PLAYED",
        playerId: "human",
        card: "Village",
        sourceIndex: 0,
      });

      builder.add({
        type: "ACTIONS_MODIFIED",
        delta: 2,
      });

      builder.add({
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Copper",
      });

      const events = builder.build();

      expect(events.length).toBe(3);
      expect(events[0]!.causedBy).toBeUndefined();
      expect(events[1]!.causedBy).toBe("evt-1");
      expect(events[2]!.causedBy).toBe("evt-1");
    });

    it("generates unique IDs for each event", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      builder.add({ type: "BUYS_MODIFIED", delta: 1 });
      builder.add({ type: "COINS_MODIFIED", delta: 1 });

      const events = builder.build();

      expect(events[0]!.id).toBe("evt-1");
      expect(events[1]!.id).toBe("evt-2");
      expect(events[2]!.id).toBe("evt-3");
    });

    it("allows overriding causedBy for nested chains", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      const lastId = builder.getLastId();
      builder.add({ type: "BUYS_MODIFIED", delta: 1 }, lastId);

      const events = builder.build();

      // The second event should be caused by the first event (evt-1)
      expect(events[1]!.causedBy).toBe(lastId);
      expect(lastId).toBe("evt-1");
    });

    it("allows explicit causedBy for first event (decision chains)", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 }, "parent-evt-5");

      const events = builder.build();

      expect(events[0]!.id).toBe("evt-1");
      expect(events[0]!.causedBy).toBe("parent-evt-5");
    });

    it("returns the added event with metadata", () => {
      const builder = new EventBuilder();

      const event = builder.add({
        type: "CARD_DRAWN",
        playerId: "human",
        card: "Copper",
      });

      expect(event.id).toBe("evt-1");
      expect(event.type).toBe("CARD_DRAWN");
      expect((event as any).playerId).toBe("human");
    });

    it("handles adding many events", () => {
      const builder = new EventBuilder();

      for (let i = 0; i < 100; i++) {
        builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      }

      const events = builder.build();

      expect(events.length).toBe(100);
      expect(events[0]!.causedBy).toBeUndefined();
      expect(events[99]!.causedBy).toBe("evt-1");
    });
  });

  describe("addAll", () => {
    it("adds multiple events at once", () => {
      const builder = new EventBuilder();

      builder.addAll([
        { type: "ACTIONS_MODIFIED", delta: 1 },
        { type: "BUYS_MODIFIED", delta: 1 },
        { type: "COINS_MODIFIED", delta: 1 },
      ]);

      const events = builder.build();

      expect(events.length).toBe(3);
      expect(events[0]!.type).toBe("ACTIONS_MODIFIED");
      expect(events[1]!.type).toBe("BUYS_MODIFIED");
      expect(events[2]!.type).toBe("COINS_MODIFIED");
    });

    it("respects causedBy override for all events", () => {
      const builder = new EventBuilder();

      builder.add({ type: "CARD_PLAYED", playerId: "human", card: "Village", sourceIndex: 0 });
      const lastId = builder.getLastId();

      builder.addAll(
        [
          { type: "ACTIONS_MODIFIED", delta: 1 },
          { type: "BUYS_MODIFIED", delta: 1 },
        ],
        lastId,
      );

      const events = builder.build();

      expect(events[1]!.causedBy).toBe("evt-1");
      expect(events[2]!.causedBy).toBe("evt-1");
    });

    it("handles empty array", () => {
      const builder = new EventBuilder();

      builder.addAll([]);

      expect(builder.isEmpty()).toBe(true);
    });

    it("can be used with add in sequence", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      builder.addAll([
        { type: "BUYS_MODIFIED", delta: 1 },
        { type: "COINS_MODIFIED", delta: 1 },
      ]);
      builder.add({ type: "ACTIONS_MODIFIED", delta: -1 });

      const events = builder.build();

      expect(events.length).toBe(4);
    });
  });

  describe("getRootId", () => {
    it("returns root ID", () => {
      const builder = new EventBuilder();

      expect(builder.getRootId()).toBe("evt-1");
    });

    it("returns custom root ID", () => {
      const builder = new EventBuilder("custom-id");

      expect(builder.getRootId()).toBe("custom-id");
    });

    it("root ID remains constant", () => {
      const builder = new EventBuilder();
      const rootId1 = builder.getRootId();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      builder.add({ type: "BUYS_MODIFIED", delta: 1 });

      const rootId2 = builder.getRootId();

      expect(rootId1).toBe(rootId2);
    });
  });

  describe("getLastId", () => {
    it("returns undefined for empty builder", () => {
      const builder = new EventBuilder();

      expect(builder.getLastId()).toBeUndefined();
    });

    it("returns ID of last added event", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      builder.add({ type: "BUYS_MODIFIED", delta: 1 });

      expect(builder.getLastId()).toBe("evt-2");
    });

    it("updates after each add", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      expect(builder.getLastId()).toBe("evt-1");

      builder.add({ type: "BUYS_MODIFIED", delta: 1 });
      expect(builder.getLastId()).toBe("evt-2");

      builder.add({ type: "COINS_MODIFIED", delta: 1 });
      expect(builder.getLastId()).toBe("evt-3");
    });
  });

  describe("build", () => {
    it("returns event array", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });
      builder.add({ type: "BUYS_MODIFIED", delta: 1 });

      const events = builder.build();

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(2);
    });

    it("returns internal array reference (not a copy)", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });

      const events1 = builder.build();
      const initialLength = events1.length;

      events1.push({
        type: "BUYS_MODIFIED",
        delta: 1,
      } as GameEvent);

      const events2 = builder.build();

      // build() returns the same internal array, so modifications affect it
      expect(events2.length).toBe(initialLength + 1);
      expect(events1).toBe(events2);
    });

    it("can be called multiple times", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });

      const events1 = builder.build();
      const events2 = builder.build();

      expect(events1).toEqual(events2);
      // Arrays are copied, so they should be equal but not the same reference
      // However, build() returns the internal array directly, not a copy
      // So this test verifies that behavior
    });
  });

  describe("isEmpty", () => {
    it("returns true for new builder", () => {
      const builder = new EventBuilder();

      expect(builder.isEmpty()).toBe(true);
    });

    it("returns false after adding event", () => {
      const builder = new EventBuilder();

      builder.add({ type: "ACTIONS_MODIFIED", delta: 1 });

      expect(builder.isEmpty()).toBe(false);
    });

    it("returns false after addAll with events", () => {
      const builder = new EventBuilder();

      builder.addAll([{ type: "ACTIONS_MODIFIED", delta: 1 }]);

      expect(builder.isEmpty()).toBe(false);
    });

    it("remains true after addAll with empty array", () => {
      const builder = new EventBuilder();

      builder.addAll([]);

      expect(builder.isEmpty()).toBe(true);
    });
  });

  describe("merge", () => {
    it("merges events from another builder", () => {
      const builder1 = new EventBuilder();
      builder1.add({ type: "ACTIONS_MODIFIED", delta: 1 });

      const builder2 = new EventBuilder();
      builder2.add({ type: "BUYS_MODIFIED", delta: 1 });

      builder1.merge(builder2);

      const events = builder1.build();

      expect(events.length).toBe(2);
      expect(events[0]!.type).toBe("ACTIONS_MODIFIED");
      expect(events[1]!.type).toBe("BUYS_MODIFIED");
    });

    it("preserves IDs and causedBy from merged builder", () => {
      const builder1 = new EventBuilder();
      builder1.add({ type: "ACTIONS_MODIFIED", delta: 1 });

      const builder2 = new EventBuilder();
      builder2.add({ type: "BUYS_MODIFIED", delta: 1 });
      const lastId = builder2.getLastId();

      builder1.merge(builder2);

      const events = builder1.build();

      expect(events[1]!.id).toBe(lastId);
    });

    it("merges multiple builders", () => {
      const builder1 = new EventBuilder();
      builder1.add({ type: "ACTIONS_MODIFIED", delta: 1 });

      const builder2 = new EventBuilder();
      builder2.add({ type: "BUYS_MODIFIED", delta: 1 });

      const builder3 = new EventBuilder();
      builder3.add({ type: "COINS_MODIFIED", delta: 1 });

      builder1.merge(builder2);
      builder1.merge(builder3);

      const events = builder1.build();

      expect(events.length).toBe(3);
    });

    it("merges empty builder (no-op)", () => {
      const builder1 = new EventBuilder();
      builder1.add({ type: "ACTIONS_MODIFIED", delta: 1 });

      const builder2 = new EventBuilder();

      builder1.merge(builder2);

      const events = builder1.build();

      expect(events.length).toBe(1);
    });
  });

  describe("complex usage patterns", () => {
    it("creates nested causality chain", () => {
      const builder = new EventBuilder();

      const root = builder.add({
        type: "CARD_PLAYED",
        playerId: "human",
        card: "Village",
        sourceIndex: 0,
      });

      const action = builder.add({ type: "ACTIONS_MODIFIED", delta: 2 });

      builder.add({ type: "CARD_DRAWN", playerId: "human", card: "Copper" }, action.id);

      const events = builder.build();

      expect(events[0]!.causedBy).toBeUndefined();
      expect(events[1]!.causedBy).toBe(root.id);
      expect(events[2]!.causedBy).toBe(action.id);
    });

    it("handles card effect pattern", () => {
      const builder = new EventBuilder();

      builder.add({
        type: "CARD_PLAYED",
        playerId: "human",
        card: "Smithy",
        sourceIndex: 0,
      });

      builder.add({ type: "ACTIONS_MODIFIED", delta: -1 });
      builder.add({ type: "CARD_DRAWN", playerId: "human", card: "Copper" });
      builder.add({ type: "CARD_DRAWN", playerId: "human", card: "Silver" });
      builder.add({ type: "CARD_DRAWN", playerId: "human", card: "Gold" });

      const events = builder.build();

      expect(events.length).toBe(5);
      expect(events[0]!.causedBy).toBeUndefined();
      events.slice(1).forEach(evt => {
        expect(evt.causedBy).toBe(events[0]!.id);
      });
    });

    it("handles decision resolution pattern", () => {
      const parentEventId = "evt-parent";
      const builder = new EventBuilder();

      builder.add(
        {
          type: "DECISION_RESOLVED",
          playerId: "human",
          choice: {
            cards: ["Copper"],
          },
        },
        parentEventId,
      );

      builder.add({
        type: "CARD_TRASHED",
        playerId: "human",
        card: "Copper",
        from: "hand",
      });

      const events = builder.build();

      expect(events[0]!.causedBy).toBe(parentEventId);
      expect(events[1]!.causedBy).toBe(events[0]!.id);
    });
  });
});

describe("linkEvents", () => {
  beforeEach(() => {
    resetEventCounter();
  });

  it("links events with generated IDs and causedBy", () => {
    const events = linkEvents(
      [
        { type: "ACTIONS_MODIFIED", delta: 1 },
        { type: "BUYS_MODIFIED", delta: 1 },
      ],
      "evt-root",
    );

    expect(events.length).toBe(2);
    expect(events[0]!.id).toBe("evt-1");
    expect(events[0]!.causedBy).toBe("evt-root");
    expect(events[1]!.id).toBe("evt-2");
    expect(events[1]!.causedBy).toBe("evt-root");
  });

  it("generates unique IDs for each event", () => {
    const events = linkEvents(
      [
        { type: "CARD_DRAWN", playerId: "human", card: "Copper" },
        { type: "CARD_DRAWN", playerId: "human", card: "Silver" },
        { type: "CARD_DRAWN", playerId: "human", card: "Gold" },
      ],
      "evt-smithy",
    );

    const ids = events.map(e => e.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });

  it("handles empty array", () => {
    const events = linkEvents([], "evt-root");

    expect(events).toEqual([]);
  });

  it("handles single event", () => {
    const events = linkEvents(
      [{ type: "ACTIONS_MODIFIED", delta: 1 }],
      "evt-root",
    );

    expect(events.length).toBe(1);
    expect(events[0]!.id).toBe("evt-1");
    expect(events[0]!.causedBy).toBe("evt-root");
  });

  it("preserves event data", () => {
    const events = linkEvents(
      [
        {
          type: "CARD_GAINED",
          playerId: "human",
          card: "Silver",
          to: "discard",
        },
      ],
      "evt-root",
    );

    expect(events[0]!.type).toBe("CARD_GAINED");
    expect((events[0] as any).playerId).toBe("human");
    expect((events[0] as any).card).toBe("Silver");
    expect((events[0] as any).to).toBe("discard");
  });

  it("can be used with different causedBy values", () => {
    const events1 = linkEvents(
      [{ type: "ACTIONS_MODIFIED", delta: 1 }],
      "evt-1",
    );
    const events2 = linkEvents(
      [{ type: "BUYS_MODIFIED", delta: 1 }],
      "evt-2",
    );

    expect(events1[0]!.causedBy).toBe("evt-1");
    expect(events2[0]!.causedBy).toBe("evt-2");
  });
});
