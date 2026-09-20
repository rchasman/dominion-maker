import { describe, it, expect } from "bun:test";
import {
  aheadByKFor,
  checkEarlyConsensus,
  isMoveLegal,
  selectConsensusWinner,
  tallyVotes,
} from "./vote";
import type { ModelResult, VoteGroup } from "./types";

type Move = { type: string; card?: string; reasoning?: string };
const key = (m: Move): string => JSON.stringify({ type: m.type, card: m.card });
const group = (
  move: Move,
  voters: VoteGroup<Move>["voters"],
  count = voters.length,
): VoteGroup<Move> => ({ key: key(move), move, voters, count });
const village: Move = { type: "play_action", card: "Village" };
const smithy: Move = { type: "play_action", card: "Smithy" };
const ok = (
  provider: ModelResult<Move>["provider"],
  result: Move,
): ModelResult<Move> => ({
  provider,
  result,
  distribution: [],
  error: null,
  duration: 1,
});

describe("aheadByKFor", () => {
  it("is at least 2 and a third of the electorate", () => {
    expect(aheadByKFor(1)).toBe(2);
    expect(aheadByKFor(8)).toBe(3);
    expect(aheadByKFor(12)).toBe(4);
  });
});

describe("checkEarlyConsensus", () => {
  it("returns the leader when ahead by K", () => {
    const groups = new Map([
      [
        key(village),
        group(village, ["gpt-4.1-mini-fast", "grok-4-fast", "grok-4-fast"]),
      ],
      [key(smithy), group(smithy, ["gemini-3.5-flash-lite"])],
    ]);
    expect(checkEarlyConsensus(groups, 2)?.move).toEqual(village);
  });
  it("returns null when not ahead by K, tied, or empty", () => {
    const groups = new Map([
      [key(village), group(village, ["gpt-4.1-mini-fast", "grok-4-fast"])],
      [key(smithy), group(smithy, ["grok-4-fast"])],
    ]);
    expect(checkEarlyConsensus(groups, 2)).toBeNull();
    expect(checkEarlyConsensus(new Map(), 2)).toBeNull();
    const tied = new Map([
      [key(village), group(village, ["gpt-4.1-mini-fast", "grok-4-fast"])],
      [key(smithy), group(smithy, ["grok-4-fast", "gemini-3.5-flash-lite"])],
    ]);
    expect(checkEarlyConsensus(tied, 1)).toBeNull();
  });

  describe("electorate safeguards", () => {
    const providers: ModelResult<Move>["provider"][] = [
      "gpt-4.1-mini-fast",
      "gpt-4.1-mini-fast",
      "gpt-4.1-mini-fast",
      "grok-4-fast",
      "grok-4-fast",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
      "glm-5.3-flash",
    ];
    const buy: Move = { type: "buy_card", card: "Silver" };
    const votes = (voters: VoteGroup<Move>["voters"]) =>
      new Map([[key(buy), group(buy, voters)]]);

    it("waits when three fast matching votes can still be overturned", () => {
      expect(
        checkEarlyConsensus(
          votes(["gpt-4.1-mini-fast", "grok-4-fast", "gemini-3.5-flash-lite"]),
          3,
          { providers, remainingVotes: 5 },
        ),
      ).toBeNull();
    });
    it("requires distinct models even with an unbeatable lead", () => {
      expect(
        checkEarlyConsensus(votes(Array(5).fill("gpt-4.1-mini-fast")), 3, {
          providers,
          remainingVotes: 3,
        }),
      ).toBeNull();
    });
    it("stops for a diverse lead that remaining votes cannot tie", () => {
      expect(
        checkEarlyConsensus(
          votes([
            "gpt-4.1-mini-fast",
            "gpt-4.1-mini-fast",
            "grok-4-fast",
            "gemini-3.5-flash-lite",
            "glm-5.3-flash",
          ]),
          3,
          { providers, remainingVotes: 3 },
        )?.count,
      ).toBe(5);
    });
    it("supports deliberately single-model electorates", () => {
      expect(
        checkEarlyConsensus(
          votes(["gpt-4.1-mini-fast", "gpt-4.1-mini-fast"]),
          2,
          {
            providers: ["gpt-4.1-mini-fast", "gpt-4.1-mini-fast"],
            remainingVotes: 0,
          },
        )?.count,
      ).toBe(2);
    });
  });
});

describe("tallyVotes", () => {
  const silver: Move = { type: "buy_card", card: "Silver" };
  const chapel: Move = { type: "buy_card", card: "Chapel" };
  it("adds a text model's pick as one whole vote", () => {
    const groups = new Map<string, VoteGroup<Move>>();
    tallyVotes(
      groups,
      {
        ...ok("gpt-5.4-nano", silver),
        distribution: [{ move: silver, weight: 1 }],
      },
      key,
    );
    expect(groups.get(key(silver))).toMatchObject({
      count: 1,
      voters: ["gpt-5.4-nano"],
    });
  });
  it("spreads Jev's mass but lists it as a voter only on its top pick", () => {
    const groups = new Map<string, VoteGroup<Move>>();
    tallyVotes(
      groups,
      {
        ...ok("jev", chapel),
        distribution: [
          { move: chapel, weight: 0.6 },
          { move: silver, weight: 0.4 },
        ],
      },
      key,
    );
    tallyVotes(
      groups,
      {
        ...ok("gpt-5.4-nano", silver),
        distribution: [{ move: silver, weight: 1 }],
      },
      key,
    );
    expect(groups.get(key(chapel))).toMatchObject({
      count: 0.6,
      voters: ["jev"],
    });
    expect(groups.get(key(silver))).toMatchObject({
      count: 1.4,
      voters: ["gpt-5.4-nano"],
    });
  });
  it("falls back to one whole vote without a distribution", () => {
    const groups = new Map<string, VoteGroup<Move>>();
    tallyVotes(groups, ok("jev", silver), key);
    expect(groups.get(key(silver))?.count).toBe(1);
  });
  it("ignores the reasoning when grouping", () => {
    const groups = new Map<string, VoteGroup<Move>>();
    tallyVotes(groups, ok("jev", { ...silver, reasoning: "a" }), key);
    tallyVotes(groups, ok("gpt-5.4-nano", { ...silver, reasoning: "b" }), key);
    expect(groups.size).toBe(1);
  });
});

describe("isMoveLegal", () => {
  it("checks structural membership", () => {
    expect(isMoveLegal(village, [village, smithy], key)).toBe(true);
    expect(
      isMoveLegal({ type: "play_action", card: "Market" }, [village], key),
    ).toBe(false);
    expect(
      isMoveLegal({ type: "end_phase" }, [village, { type: "end_phase" }], key),
    ).toBe(true);
  });
});

describe("selectConsensusWinner", () => {
  it("selects the most voted legal move and counts successful results", () => {
    const groups = new Map([
      [
        key(village),
        group(village, ["gpt-4.1-mini-fast", "grok-4-fast", "grok-4-fast"]),
      ],
      [key(smithy), group(smithy, ["gemini-3.5-flash-lite"])],
    ]);
    const results = [
      ok("gpt-4.1-mini-fast", village),
      ok("grok-4-fast", village),
      ok("grok-4-fast", village),
      ok("gemini-3.5-flash-lite", smithy),
    ];
    const { winner, votesConsidered } = selectConsensusWinner(
      groups,
      results,
      null,
      [village, smithy],
      key,
    );
    expect(winner.move).toEqual(village);
    expect(votesConsidered).toBe(4);
  });
  it("uses a legal early consensus winner", () => {
    const early = group(village, ["gpt-4.1-mini-fast", "grok-4-fast"]);
    const { winner, validEarlyConsensus } = selectConsensusWinner(
      new Map([[early.key, early]]),
      [ok("gpt-4.1-mini-fast", village)],
      early,
      [village],
      key,
    );
    expect(winner.move).toEqual(village);
    expect(validEarlyConsensus).toBe(true);
  });
  it("filters out illegal moves", () => {
    const market: Move = { type: "play_action", card: "Market" };
    const groups = new Map([
      [key(market), group(market, ["gpt-4.1-mini-fast", "grok-4-fast"])],
      [key(village), group(village, ["grok-4-fast"])],
    ]);
    const { winner } = selectConsensusWinner(
      groups,
      [ok("gpt-4.1-mini-fast", market), ok("grok-4-fast", village)],
      null,
      [village],
      key,
    );
    expect(winner.move).toEqual(village);
  });
  it("throws when every model failed or every move is illegal", () => {
    const failed: ModelResult<Move> = {
      provider: "gpt-4.1-mini-fast",
      result: null,
      distribution: [],
      error: new Error("x"),
      duration: 1,
    };
    expect(() =>
      selectConsensusWinner(new Map(), [failed], null, [village], key),
    ).toThrow("All AI models failed");
    const market: Move = { type: "play_action", card: "Market" };
    expect(() =>
      selectConsensusWinner(
        new Map([[key(market), group(market, ["gpt-4.1-mini-fast"])]]),
        [ok("gpt-4.1-mini-fast", market)],
        null,
        [village],
        key,
      ),
    ).toThrow("All AI actions invalid");
  });
  it("breaks ties by key", () => {
    const groups = new Map([
      [key(village), group(village, ["gpt-4.1-mini-fast"])],
      [key(smithy), group(smithy, ["grok-4-fast"])],
    ]);
    const { winner } = selectConsensusWinner(
      groups,
      [ok("gpt-4.1-mini-fast", village), ok("grok-4-fast", smithy)],
      null,
      [village, smithy],
      key,
    );
    const [first] = [key(village), key(smithy)].sort();
    expect(winner.key).toBe(first ?? "");
  });
});
