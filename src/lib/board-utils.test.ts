import { describe, it, expect } from "bun:test";
import { aggregateLogEntries } from "./board-utils";
import type { LogEntry } from "../types/game-state";

describe("aggregateLogEntries", () => {
  describe("Test Suite 1: Root-Level Aggregation", () => {
    it("consecutive play-treasure (same card) → aggregate with summed coins", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-2",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-3",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.type).toBe("play-treasure");
      expect((result[0] as any).coins).toBe(3);
      expect((result[0] as any).children?.[0]?.type).toBe("text");
      expect((result[0] as any).children?.[0]?.message).toBe("3x");
      expect((result[0] as any).eventIds).toEqual(["evt-1", "evt-2", "evt-3"]);
    });

    it("consecutive play-action (same card) → aggregate with Nx child", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Village",
          eventId: "evt-1",
        },
        {
          type: "play-action",
          playerId: "human",
          card: "Village",
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.type).toBe("play-action");
      expect((result[0] as any).children?.[0]?.type).toBe("text");
      expect((result[0] as any).children?.[0]?.message).toBe("2x");
      expect((result[0] as any).eventIds).toEqual(["evt-1", "evt-2"]);
    });

    it("consecutive draw-cards → aggregate with combined counts", () => {
      const log: LogEntry[] = [
        {
          type: "draw-cards",
          playerId: "human",
          count: 2,
          cards: ["Copper", "Silver"],
          eventId: "evt-1",
        },
        {
          type: "draw-cards",
          playerId: "human",
          count: 1,
          cards: ["Gold"],
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.type).toBe("draw-cards");
      expect((result[0] as any).count).toBe(3);
      expect((result[0] as any).cards).toEqual(["Copper", "Silver", "Gold"]);
      expect((result[0] as any).cardCounts).toEqual({
        Copper: 1,
        Silver: 1,
        Gold: 1,
      });
      expect((result[0] as any).eventIds).toEqual(["evt-1", "evt-2"]);
    });

    it("consecutive discard-cards → aggregate with combined counts", () => {
      const log: LogEntry[] = [
        {
          type: "discard-cards",
          playerId: "human",
          count: 1,
          cards: ["Estate"],
          eventId: "evt-1",
        },
        {
          type: "discard-cards",
          playerId: "human",
          count: 1,
          cards: ["Copper"],
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.type).toBe("discard-cards");
      expect((result[0] as any).count).toBe(2);
      expect((result[0] as any).cards).toEqual(["Estate", "Copper"]);
      expect((result[0] as any).cardCounts).toEqual({
        Estate: 1,
        Copper: 1,
      });
    });

    it("consecutive reveal-card (same player, same from) → aggregate with batched cards", () => {
      const log: LogEntry[] = [
        {
          type: "reveal-card",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          eventId: "evt-1",
        },
        {
          type: "reveal-card",
          playerId: "ai",
          card: "Gold",
          from: "deck",
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.type).toBe("reveal-card");
      expect(result[0]?.card).toBe("Silver, Gold");
      expect((result[0] as any).eventIds).toEqual(["evt-1", "evt-2"]);
    });

    it("non-consecutive entries remain separate", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-action",
          playerId: "human",
          card: "Village",
          eventId: "evt-2",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-3",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(3);
    });

    it("different cards don't aggregate (except draw-cards/discard-cards)", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Silver",
          coins: 2,
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(2);
    });

    it("draw-cards can aggregate across different cards", () => {
      const log: LogEntry[] = [
        {
          type: "draw-cards",
          playerId: "human",
          count: 1,
          cards: ["Copper"],
          eventId: "evt-1",
        },
        {
          type: "draw-cards",
          playerId: "human",
          count: 1,
          cards: ["Silver"],
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect((result[0] as any).count).toBe(2);
      expect((result[0] as any).cards).toEqual(["Copper", "Silver"]);
    });

    it("buy-card aggregation includes VP sum", () => {
      const log: LogEntry[] = [
        {
          type: "buy-card",
          playerId: "human",
          card: "Estate",
          vp: 1,
          eventId: "evt-1",
          children: [
            { type: "gain-card", playerId: "human", card: "Estate" },
          ],
        },
        {
          type: "buy-card",
          playerId: "human",
          card: "Estate",
          vp: 1,
          eventId: "evt-2",
          children: [
            { type: "gain-card", playerId: "human", card: "Estate" },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect((result[0] as any).vp).toBe(2);
      expect((result[0] as any).children?.[0]?.type).toBe("text");
      expect((result[0] as any).children?.[0]?.message).toBe("2x");
    });

    it("different players don't aggregate", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "ai",
          card: "Copper",
          coins: 1,
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(2);
    });
  });

  describe("Test Suite 2: Recursive Children Aggregation (CRITICAL)", () => {
    it("parent with reveal-card children → children get batched", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.children?.length).toBe(1);
      expect(result[0]?.children?.[0]?.type).toBe("reveal-card");
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Gold");
    });

    it("parent with draw-cards children → children get batched", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Smithy",
          eventId: "evt-1",
          children: [
            {
              type: "draw-cards",
              playerId: "human",
              count: 1,
              cards: ["Copper"],
              eventId: "evt-2",
            },
            {
              type: "draw-cards",
              playerId: "human",
              count: 1,
              cards: ["Silver"],
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.children?.length).toBe(1);
      expect((result[0]?.children?.[0] as any).count).toBe(2);
      expect((result[0]?.children?.[0] as any).cards).toEqual([
        "Copper",
        "Silver",
      ]);
    });

    it("multi-level nesting: grandchildren also aggregated", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "play-action",
              playerId: "ai",
              card: "Moat",
              eventId: "evt-2",
              children: [
                {
                  type: "draw-cards",
                  playerId: "ai",
                  count: 1,
                  cards: ["Copper"],
                  eventId: "evt-3",
                },
                {
                  type: "draw-cards",
                  playerId: "ai",
                  count: 1,
                  cards: ["Silver"],
                  eventId: "evt-4",
                },
              ],
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.children?.length).toBe(1);
      expect(result[0]?.children?.[0]?.children?.length).toBe(1);
      expect((result[0]?.children?.[0]?.children?.[0] as any).count).toBe(2);
    });

    it("mixed children (some aggregatable, some not) → only aggregatable batch", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: "evt-3",
            },
            {
              type: "trash-card",
              playerId: "ai",
              card: "Silver",
              eventId: "evt-4",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.children?.length).toBe(2);
      expect(result[0]?.children?.[0]?.type).toBe("reveal-card");
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Gold");
      expect(result[0]?.children?.[1]?.type).toBe("trash-card");
    });

    it("single entry with children → children still processed recursively", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.children?.length).toBe(1);
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Gold");
    });

    it("non-aggregatable parent still recursively processes children", () => {
      const log: LogEntry[] = [
        {
          type: "turn-start",
          turn: 1,
          playerId: "human",
          eventId: "evt-1",
          children: [
            {
              type: "draw-cards",
              playerId: "human",
              count: 1,
              cards: ["Copper"],
              eventId: "evt-2",
            },
            {
              type: "draw-cards",
              playerId: "human",
              count: 1,
              cards: ["Silver"],
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.children?.length).toBe(1);
      expect((result[0]?.children?.[0] as any).count).toBe(2);
    });

    it("deep nesting (10+ levels) → no stack overflow", () => {
      let currentLog: LogEntry = {
        type: "draw-cards",
        playerId: "human",
        count: 1,
        cards: ["Copper"],
        eventId: "evt-deep",
      };

      for (let i = 0; i < 15; i++) {
        currentLog = {
          type: "play-action",
          playerId: "human",
          card: "Village",
          eventId: `evt-${i}`,
          children: [currentLog],
        };
      }

      const result = aggregateLogEntries([currentLog]);
      expect(result.length).toBe(1);
      let depth = 0;
      let current = result[0];
      while (current?.children && current.children.length > 0) {
        depth++;
        current = current.children[0];
      }
      expect(depth).toBeGreaterThan(10);
    });
  });

  describe("Test Suite 3: canMatchNext Logic", () => {
    it("same type + player + card → matches", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
    });

    it("different type → no match", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-action",
          playerId: "human",
          card: "Village",
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(2);
    });

    it("different player → no match", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "ai",
          card: "Copper",
          coins: 1,
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(2);
    });

    it("reveal-card: same 'from' → matches (different cards OK)", () => {
      const log: LogEntry[] = [
        {
          type: "reveal-card",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          eventId: "evt-1",
        },
        {
          type: "reveal-card",
          playerId: "ai",
          card: "Gold",
          from: "deck",
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.card).toBe("Silver, Gold");
    });

    it("reveal-card: different 'from' → no match", () => {
      const log: LogEntry[] = [
        {
          type: "reveal-card",
          playerId: "ai",
          card: "Silver",
          from: "deck",
          eventId: "evt-1",
        },
        {
          type: "reveal-card",
          playerId: "ai",
          card: "Gold",
          from: "hand",
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(2);
    });

    it("draw-cards / discard-cards don't require card match", () => {
      const log: LogEntry[] = [
        {
          type: "draw-cards",
          playerId: "human",
          count: 1,
          cards: ["Copper"],
          eventId: "evt-1",
        },
        {
          type: "draw-cards",
          playerId: "human",
          count: 1,
          cards: ["Silver"],
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect((result[0] as any).cards).toEqual(["Copper", "Silver"]);
    });

    it("entries with different cards (play-treasure) → no match", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Silver",
          coins: 2,
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(2);
    });
  });

  describe("Test Suite 4: Edge Cases", () => {
    it("empty log array → empty result", () => {
      const result = aggregateLogEntries([]);
      expect(result.length).toBe(0);
    });

    it("single entry → children processed but no aggregation", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect(result[0]?.children?.length).toBe(1);
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Gold");
    });

    it("all entries same type → fully aggregated", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-2",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-3",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-4",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect((result[0] as any).coins).toBe(4);
    });

    it("entry with undefined children → handled correctly", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Village",
          eventId: "evt-1",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      // aggregateLogEntries may return empty array instead of undefined
      expect(
        result[0]?.children === undefined || result[0]?.children?.length === 0,
      ).toBe(true);
    });

    it("entry with empty children array → handled correctly", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Village",
          eventId: "evt-1",
          children: [],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect((result[0]?.children as any)?.length).toBe(0);
    });

    it("eventId preservation through aggregation", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-1",
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect((result[0] as any).eventIds).toEqual(["evt-1", "evt-2"]);
    });

    it("entries without eventId → eventIds array is empty", () => {
      const log: LogEntry[] = [
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
        },
        {
          type: "play-treasure",
          playerId: "human",
          card: "Copper",
          coins: 1,
        },
      ];
      const result = aggregateLogEntries(log);
      expect((result[0] as any).eventIds).toEqual([]);
    });

    it("duplicate cards in draw-cards show correct counts", () => {
      const log: LogEntry[] = [
        {
          type: "draw-cards",
          playerId: "human",
          count: 2,
          cards: ["Copper", "Copper"],
          eventId: "evt-1",
        },
        {
          type: "draw-cards",
          playerId: "human",
          count: 1,
          cards: ["Copper"],
          eventId: "evt-2",
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result.length).toBe(1);
      expect((result[0] as any).count).toBe(3);
      expect((result[0] as any).cardCounts).toEqual({ Copper: 3 });
    });
  });

  describe("Test Suite 5: CARD_REVEALED Batching Regression (CRITICAL)", () => {
    it("Bandit reveals batch correctly (regression test)", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result[0]?.children?.length).toBe(1);
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Gold");
      expect((result[0]?.children?.[0] as any).eventIds).toEqual([
        "evt-2",
        "evt-3",
      ]);
    });

    it("two CARD_REVEALED children under Bandit → batch to 'Card1, Card2'", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Copper",
              from: "deck",
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result[0]?.children?.length).toBe(1);
      expect(result[0]?.children?.[0]?.type).toBe("reveal-card");
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Copper");
    });

    it("two CARD_REVEALED of same card → show as 'Card, Card' (both listed)", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result[0]?.children?.length).toBe(1);
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Silver");
    });

    it("CARD_REVEALED from different 'from' sources → don't batch", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bureaucrat",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "hand",
              eventId: "evt-3",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result[0]?.children?.length).toBe(2);
      expect(result[0]?.children?.[0]?.type).toBe("reveal-card");
      expect(result[0]?.children?.[1]?.type).toBe("reveal-card");
    });

    it("eventIds preserved through batching", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: "evt-3",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Copper",
              from: "deck",
              eventId: "evt-4",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect((result[0]?.children?.[0] as any).eventIds).toEqual([
        "evt-2",
        "evt-3",
        "evt-4",
      ]);
    });

    it("multiple opponents revealing cards → each opponent's reveals batched separately", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai1",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "reveal-card",
              playerId: "ai1",
              card: "Gold",
              from: "deck",
              eventId: "evt-3",
            },
            {
              type: "reveal-card",
              playerId: "ai2",
              card: "Copper",
              from: "deck",
              eventId: "evt-4",
            },
            {
              type: "reveal-card",
              playerId: "ai2",
              card: "Estate",
              from: "deck",
              eventId: "evt-5",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result[0]?.children?.length).toBe(2);
      expect(result[0]?.children?.[0]?.card).toBe("Silver, Gold");
      expect(result[0]?.children?.[0]?.playerId).toBe("ai1");
      expect(result[0]?.children?.[1]?.card).toBe("Copper, Estate");
      expect(result[0]?.children?.[1]?.playerId).toBe("ai2");
    });

    it("reveals interrupted by non-reveal entry → separate batches", () => {
      const log: LogEntry[] = [
        {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: "evt-1",
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: "evt-2",
            },
            {
              type: "trash-card",
              playerId: "ai",
              card: "Silver",
              eventId: "evt-3",
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: "evt-4",
            },
          ],
        },
      ];
      const result = aggregateLogEntries(log);
      expect(result[0]?.children?.length).toBe(3);
      expect(result[0]?.children?.[0]?.type).toBe("reveal-card");
      expect(result[0]?.children?.[1]?.type).toBe("trash-card");
      expect(result[0]?.children?.[2]?.type).toBe("reveal-card");
    });

    it("recursion depth test with reveals → no stack overflow", () => {
      let currentLog: LogEntry = {
        type: "reveal-card",
        playerId: "ai",
        card: "Copper",
        from: "deck",
        eventId: "evt-deep",
      };

      for (let i = 0; i < 20; i++) {
        currentLog = {
          type: "play-action",
          playerId: "human",
          card: "Bandit",
          eventId: `evt-${i}`,
          children: [
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Silver",
              from: "deck",
              eventId: `evt-${i}-1`,
            },
            {
              type: "reveal-card",
              playerId: "ai",
              card: "Gold",
              from: "deck",
              eventId: `evt-${i}-2`,
            },
            currentLog,
          ],
        };
      }

      const result = aggregateLogEntries([currentLog]);
      expect(result.length).toBe(1);
    });
  });
});
