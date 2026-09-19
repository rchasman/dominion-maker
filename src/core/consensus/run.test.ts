import { describe, it, expect } from "bun:test";
import { runModelsInParallel } from "./run";
import type { DecideMoveFor, LLMLogEntryInput } from "./types";

type Move = { type: string };
const key = (m: Move) => m.type;
const end: Move = { type: "end_phase" };
const buy: Move = { type: "buy_card" };

const base = (
  decideMove: DecideMoveFor<null, Move>,
  signal = new AbortController().signal,
) => ({
  providers: [
    "gpt-5.4-mini",
    "grok-4-fast",
    "gemini-3.1-flash-lite",
    "glm-4.7-flash",
  ] as const,
  state: null,
  actionId: "t1",
  playerStrategies: {},
  customStrategy: "",
  aheadByK: 2,
  decideMove,
  moveKey: key,
  signal,
});

describe("runModelsInParallel", () => {
  it("tallies every answer and reports no early consensus on a split vote", async () => {
    const byProvider: Record<string, Move> = {
      "gpt-5.4-mini": end,
      "grok-4-fast": buy,
      "gemini-3.1-flash-lite": end,
      "glm-4.7-flash": buy,
    };
    const decideMove: DecideMoveFor<null, Move> = ({ provider }) =>
      Promise.resolve({ move: byProvider[provider] ?? end, distribution: [] });
    const params = base(decideMove);
    const result = await runModelsInParallel({
      ...params,
      providers: [...params.providers],
    });
    expect(result.earlyConsensus).toBeNull();
    expect(result.voteGroups.get("end_phase")?.count).toBe(2);
    expect(result.voteGroups.get("buy_card")?.count).toBe(2);
  });

  it("stops early once a diverse lead cannot be overturned and aborts the rest", async () => {
    const log: LLMLogEntryInput[] = [];
    const decideMove: DecideMoveFor<null, Move> = ({ provider, signal }) =>
      provider === "glm-4.7-flash"
        ? new Promise((_, reject) =>
            signal.addEventListener("abort", () =>
              reject(new Error("AbortError")),
            ),
          )
        : Promise.resolve({ move: end, distribution: [] });
    const params = base(decideMove);
    const result = await runModelsInParallel({
      ...params,
      providers: [...params.providers],
      logger: e => {
        log.push(e);
      },
    });
    expect(result.earlyConsensus?.move).toEqual(end);
    expect(log.some(e => e.type === "consensus-model-aborted")).toBe(true);
  });

  it("cancels in-flight calls when the outer signal aborts", async () => {
    const outer = new AbortController();
    const decideMove: DecideMoveFor<null, Move> = ({ signal }) =>
      new Promise((_, reject) =>
        signal.addEventListener("abort", () => reject(new Error("aborted"))),
      );
    const params = base(decideMove, outer.signal);
    const pending = runModelsInParallel({
      ...params,
      providers: [...params.providers],
    });
    outer.abort();
    const result = await pending;
    expect(result.earlyConsensus).toBeNull();
    expect(result.results.every(r => r.result === null)).toBe(true);
  });
});
