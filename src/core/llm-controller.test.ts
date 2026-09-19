import { describe, it, expect } from "bun:test";
import { llmController, type DecideMove } from "./llm-controller";
import { DEFAULT_LLM_SEAT } from "./seats";
import { dominionGame, type DominionShape } from "../dominion/definition";
import { fixture } from "../dominion/test-fixture";
import type { Action } from "../types/action";
import type { LLMLogEntryInput } from "./consensus/types";

const pick =
  (move: Action): DecideMove<DominionShape> =>
  () =>
    Promise.resolve({ move, distribution: [] });
const noStrategies = () => ({});
const signal = () => new AbortController().signal;

describe("llmController", () => {
  it("answers a Throne Room decision with SUBMIT_DECISION", async () => {
    const engine = fixture([
      "Throne Room",
      "Bandit",
      "Estate",
      "Copper",
      "Copper",
    ]);
    engine.playAction("alice", "Throne Room");
    const calls: string[] = [];
    const controller = llmController(
      dominionGame,
      { ...DEFAULT_LLM_SEAT, consensusCount: 3 },
      {
        decideMove: input => {
          calls.push(input.provider);
          return pick({ type: "play_action", card: "Bandit" })(input);
        },
        getPlayerStrategies: noStrategies,
      },
    );
    const command = await controller.decide(engine, "alice", signal());
    expect(command).toEqual({
      type: "SUBMIT_DECISION",
      playerId: "alice",
      choice: { selectedCards: ["Bandit"] },
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(engine.dispatch(command, "alice").ok).toBe(true);
  });

  it("makes no model call when only one move is legal", async () => {
    const engine = fixture(["Copper", "Copper", "Copper", "Estate", "Estate"]);
    engine.endPhase("alice");
    engine.playAllTreasures("alice");
    engine.buyCard("alice", "Estate");
    const counter = { calls: 0 };
    const controller = llmController(dominionGame, DEFAULT_LLM_SEAT, {
      decideMove: input => {
        counter.calls++;
        return pick({ type: "end_phase" })(input);
      },
      getPlayerStrategies: noStrategies,
    });
    expect(await controller.decide(engine, "alice", signal())).toEqual({
      type: "END_PHASE",
      playerId: "alice",
    });
    expect(counter.calls).toBe(0);
  });

  it("auto-plays a simple treasure without a model call", async () => {
    const engine = fixture(["Copper", "Silver", "Estate", "Estate", "Estate"]);
    engine.endPhase("alice");
    const counter = { calls: 0 };
    const controller = llmController(dominionGame, DEFAULT_LLM_SEAT, {
      decideMove: input => {
        counter.calls++;
        return pick({ type: "end_phase" })(input);
      },
      getPlayerStrategies: noStrategies,
    });
    expect(await controller.decide(engine, "alice", signal())).toEqual({
      type: "PLAY_TREASURE",
      playerId: "alice",
      card: "Copper",
    });
    expect(counter.calls).toBe(0);
  });

  it("votes round by round for Chapel and submits one decision", async () => {
    const engine = fixture(["Chapel", "Estate", "Estate", "Copper", "Curse"]);
    engine.playAction("alice", "Chapel");
    const answers: Action[] = [
      { type: "trash_card", card: "Curse" },
      { type: "trash_card", card: "Estate" },
      { type: "skip_decision" },
    ];
    const controller = llmController(
      dominionGame,
      { ...DEFAULT_LLM_SEAT, consensusCount: 2, models: ["gpt-5.4-nano"] },
      {
        decideMove: input => {
          const round = Number(input.actionId.split("-r").at(-1));
          return pick(answers[round] ?? { type: "skip_decision" })(input);
        },
        getPlayerStrategies: noStrategies,
      },
    );
    const command = await controller.decide(engine, "alice", signal());
    expect(command).toEqual({
      type: "SUBMIT_DECISION",
      playerId: "alice",
      choice: { selectedCards: ["Curse", "Estate"] },
    });
    expect(engine.dispatch(command, "alice").ok).toBe(true);
  });

  it("emits ai-turn-start once per turn and ai-decision-resolving for choices", async () => {
    const engine = fixture([
      "Throne Room",
      "Bandit",
      "Estate",
      "Copper",
      "Copper",
    ]);
    const types: string[] = [];
    const firstLegal: DecideMove<DominionShape> = ({ state }) =>
      Promise.resolve({
        move: dominionGame.legalMoves(state, "alice")[0] ?? {
          type: "end_phase",
        },
        distribution: [],
      });
    const controller = llmController(
      dominionGame,
      { ...DEFAULT_LLM_SEAT, consensusCount: 1 },
      {
        decideMove: firstLegal,
        getPlayerStrategies: noStrategies,
        logger: (entry: LLMLogEntryInput) => {
          types.push(entry.type);
        },
      },
    );
    const first = await controller.decide(engine, "alice", signal());
    expect(first).toEqual({
      type: "PLAY_ACTION",
      playerId: "alice",
      card: "Throne Room",
    });
    engine.dispatch(first, "alice");
    await controller.decide(engine, "alice", signal());
    expect(types.filter(t => t === "ai-turn-start")).toHaveLength(1);
    expect(types.filter(t => t === "ai-decision-resolving")).toHaveLength(1);
    expect(types.filter(t => t === "consensus-voting")).toHaveLength(2);
  });

  it("keeps each model's reasoning in the voting log", async () => {
    const engine = fixture(["Smithy", "Village", "Market", "Copper", "Copper"]);
    const entries: LLMLogEntryInput[] = [];
    const controller = llmController(
      dominionGame,
      { ...DEFAULT_LLM_SEAT, consensusCount: 1, models: ["gpt-5.4-mini"] },
      {
        decideMove: pick({
          type: "play_action",
          card: "Smithy",
          reasoning: "Test reasoning",
        }),
        getPlayerStrategies: noStrategies,
        logger: entry => {
          entries.push(entry);
        },
        reasoningOf: move => move.reasoning,
      },
    );
    await controller.decide(engine, "alice", signal());
    const voting = entries.find(e => e.type === "consensus-voting");
    const results = voting?.data?.["allResults"];
    expect(Array.isArray(results)).toBe(true);
    if (!Array.isArray(results)) return;
    expect(results[0]).toMatchObject({
      reasonings: [{ provider: "gpt-5.4-mini", reasoning: "Test reasoning" }],
    });
  });

  it("reads the strategies fresh on every decision", async () => {
    const engine = fixture(["Village", "Smithy", "Copper", "Copper", "Estate"]);
    const box: { strategies: Record<string, unknown> } = {
      strategies: { alice: { gameplan: "old" } },
    };
    const seen: unknown[] = [];
    const controller = llmController(
      dominionGame,
      { ...DEFAULT_LLM_SEAT, consensusCount: 1 },
      {
        decideMove: input => {
          seen.push(input.playerStrategies);
          return pick({ type: "play_action", card: "Village" })(input);
        },
        getPlayerStrategies: () => box.strategies,
      },
    );
    await controller.decide(engine, "alice", signal());
    box.strategies = { alice: { gameplan: "updated" } };
    await controller.decide(engine, "alice", signal());
    expect(seen).toEqual([
      { alice: { gameplan: "old" } },
      { alice: { gameplan: "updated" } },
    ]);
  });

  it("passes the strategies and custom strategy to every model call", async () => {
    const engine = fixture(["Village", "Smithy", "Copper", "Copper", "Estate"]);
    const seen: Array<{ s: Record<string, unknown>; c: string }> = [];
    const controller = llmController(
      dominionGame,
      { ...DEFAULT_LLM_SEAT, consensusCount: 2, customStrategy: "Buy Gold" },
      {
        decideMove: input => {
          seen.push({ s: input.playerStrategies, c: input.customStrategy });
          return pick({ type: "play_action", card: "Village" })(input);
        },
        getPlayerStrategies: () => ({ alice: { gameplan: "BM" } }),
      },
    );
    await controller.decide(engine, "alice", signal());
    expect(seen[0]).toEqual({
      s: { alice: { gameplan: "BM" } },
      c: "Buy Gold",
    });
  });
});
