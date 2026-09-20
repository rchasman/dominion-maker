import { describe, it, expect } from "bun:test";
import { driveEngine } from "./driver";
import type { Controller } from "./controller";
import {
  adder,
  bHuman,
  bothBots,
  game,
  makeEngine,
  type G,
} from "./counting-game.test-fixture";

describe("driveEngine", () => {
  it("drives non-human seats and stops when a human must act", async () => {
    const engine = makeEngine();
    await driveEngine(engine, {
      game,
      getSeats: () => bHuman,
      controllerFor: c => (c.kind === "human" ? null : adder(1)),
      stepDelayMs: 0,
      signal: new AbortController().signal,
    });
    expect(engine.state).toEqual({ n: 1, turn: "b", over: false });
  });

  it("runs to game over when every seat is non-human", async () => {
    const engine = makeEngine();
    const steps: number[] = [];
    await driveEngine(engine, {
      game,
      getSeats: () => bothBots,
      controllerFor: () => adder(2),
      onStep: events => {
        steps.push(events.length);
      },
      stepDelayMs: 0,
      signal: new AbortController().signal,
    });
    expect(engine.state.over).toBe(true);
    expect(steps).toEqual([1, 1, 1]);
  });

  it("reads seats every step so a live swap to human stops it", async () => {
    const engine = makeEngine();
    const box = { seats: bothBots };
    await driveEngine(engine, {
      game,
      getSeats: () => box.seats,
      controllerFor: () => adder(1),
      onStep: () => {
        box.seats = { ...box.seats, b: { kind: "human" } };
      },
      stepDelayMs: 0,
      signal: new AbortController().signal,
    });
    expect(engine.state).toEqual({ n: 1, turn: "b", over: false });
  });

  it("stops on abort without dispatching a pending decision", async () => {
    const engine = makeEngine();
    const abort = new AbortController();
    const slow: Controller<G> = {
      decide: (_e, player) =>
        new Promise(resolve =>
          setTimeout(() => resolve({ add: 1, by: player }), 20),
        ),
    };
    const run = driveEngine(engine, {
      game,
      getSeats: () => bothBots,
      controllerFor: () => slow,
      stepDelayMs: 0,
      signal: abort.signal,
    });
    abort.abort();
    await run;
    expect(engine.state.n).toBe(0);
  });

  it("discards a decision made against a log that changed meanwhile", async () => {
    const engine = makeEngine();
    const counter = { decisions: 0 };
    const racing: Controller<G> = {
      decide: (e, player) => {
        counter.decisions++;
        if (counter.decisions === 1) e.dispatch({ add: 2, by: "a" }, "a");
        return Promise.resolve({ add: 1, by: player });
      },
    };
    await driveEngine(engine, {
      game,
      getSeats: () => bHuman,
      controllerFor: () => racing,
      stepDelayMs: 0,
      signal: new AbortController().signal,
    });
    expect(engine.log).toEqual([{ type: "ADDED", playerId: "a", add: 2 }]);
    expect(counter.decisions).toBe(1);
  });

  it("logs and retries a rejected dispatch with a consecutive count", async () => {
    const counter = { rejections: 0 };
    const engine = makeEngine(c =>
      c.add === 1 && counter.rejections++ < 2 ? "No" : null,
    );
    const errors: string[] = [];
    await driveEngine(engine, {
      game,
      getSeats: () => bHuman,
      controllerFor: () => adder(1),
      stepDelayMs: 0,
      minRetryDelayMs: 0,
      signal: new AbortController().signal,
      logError: message => {
        errors.push(message);
      },
    });
    expect(engine.state.n).toBe(1);
    expect(errors).toEqual([
      'a: {"add":1,"by":"a"} rejected: No (failure 1)',
      'a: {"add":1,"by":"a"} rejected: No (failure 2)',
    ]);
  });

  it("logs and retries when decide throws", async () => {
    const engine = makeEngine();
    const counter = { calls: 0 };
    const flaky: Controller<G> = {
      decide: (_e, player) => {
        counter.calls++;
        return counter.calls === 1
          ? Promise.reject(new Error("boom"))
          : Promise.resolve({ add: 1, by: player });
      },
    };
    const errors: string[] = [];
    await driveEngine(engine, {
      game,
      getSeats: () => bHuman,
      controllerFor: () => flaky,
      stepDelayMs: 0,
      minRetryDelayMs: 0,
      signal: new AbortController().signal,
      logError: message => {
        errors.push(message);
      },
    });
    expect(engine.state.n).toBe(1);
    expect(errors).toEqual(["a: decide failed: boom (failure 1)"]);
  });
});
