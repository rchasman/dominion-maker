import { describe, it, expect } from "bun:test";
import { createSeatDriver } from "./seat-driver";
import type { ControllerConfig, Seats } from "./seats";
import {
  aHuman,
  adder,
  bHuman,
  bothBots,
  game,
  makeEngine,
  type G,
  type P,
  type TestEngine,
} from "./counting-game.test-fixture";

const POLL_MS = 5;
const TIMEOUT_MS = 5000;
const STEP_WINDOW_MS = 100;

async function waitFor(label: string, condition: () => boolean) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const botAdder = (config: ControllerConfig) => {
  if (config.kind === "human") return null;
  return adder(config.kind === "heuristic" ? 1 : 2);
};

const LLM_SEAT: ControllerConfig = {
  kind: "llm",
  models: [],
  consensusCount: 1,
  customStrategy: "",
};

type Recorder = {
  engine: TestEngine;
  syncs: number[];
  processing: boolean[];
};

function attach(
  seatsRef: { current: Seats<P> },
  stepDelayMs: number,
): Recorder & { driver: ReturnType<typeof createSeatDriver<G>> } {
  const engine = makeEngine();
  const syncs: number[] = [];
  const processing: boolean[] = [];
  const driver = createSeatDriver<G>({
    game,
    engineRef: { current: engine },
    controllerFor: botAdder,
    logger: () => {},
    stepDelayMs,
    onSync: events => syncs.push(events.length),
    getSeats: () => seatsRef.current,
    setProcessing: value => processing.push(value),
    localPlayerId: () => null,
  });
  return { engine, syncs, processing, driver };
}

describe("createSeatDriver", () => {
  it("drives every bot seat to game over and syncs each step", async () => {
    const seatsRef = { current: bothBots };
    const { engine, syncs, processing, driver } = attach(seatsRef, 0);

    driver.update(engine.state, seatsRef.current);
    await waitFor("the game to end", () => engine.state.over);
    await waitFor("processing to clear", () => processing.at(-1) === false);

    expect(engine.state.n).toBe(5);
    expect(syncs).toEqual([1, 2, 3, 4, 5, 5]);
    expect(processing).toEqual([true, false]);
    driver.dispose();
  });

  it("stops at a human seat and never starts for one", async () => {
    const seatsRef = { current: bHuman };
    const stops = attach(seatsRef, 0);
    stops.driver.update(stops.engine.state, seatsRef.current);
    await waitFor(
      "processing to clear",
      () => stops.processing.at(-1) === false,
    );
    expect(stops.engine.state.n).toBe(1);
    expect(stops.processing).toEqual([true, false]);
    stops.driver.dispose();

    const idleSeats = { current: aHuman };
    const idle = attach(idleSeats, 0);
    idle.driver.update(idle.engine.state, idleSeats.current);
    await sleep(STEP_WINDOW_MS);
    expect(idle.engine.log).toEqual([]);
    expect(idle.processing).toEqual([]);
    expect(idle.syncs).toEqual([]);
    idle.driver.dispose();
  });

  it("keeps one run alive across updates with an unchanged seat", async () => {
    const seatsRef = { current: bothBots };
    const { engine, processing, driver } = attach(seatsRef, STEP_WINDOW_MS);

    driver.update(engine.state, seatsRef.current);
    await waitFor("the first step", () => engine.log.length === 1);
    driver.update(engine.state, { ...bothBots });
    driver.update(engine.state, { ...bothBots });
    expect(processing).toEqual([true]);

    await waitFor("the game to end", () => engine.state.over);
    await waitFor("processing to clear", () => processing.at(-1) === false);
    expect(processing).toEqual([true, false]);
    driver.dispose();
  });

  it("aborts and restarts when the acting seat changes", async () => {
    const seatsRef = { current: bothBots };
    const { engine, processing, driver } = attach(seatsRef, STEP_WINDOW_MS);

    driver.update(engine.state, seatsRef.current);
    await waitFor("the first step", () => engine.log.length === 1);

    seatsRef.current = { a: { kind: "heuristic" }, b: LLM_SEAT };
    driver.update(engine.state, seatsRef.current);
    expect(processing).toEqual([true, false, true]);

    await waitFor("the restarted step", () => engine.log.length === 2);
    expect(processing.at(-1)).toBe(true);

    await waitFor("the game to end", () => engine.state.over);
    await waitFor("processing to clear", () => processing.at(-1) === false);
    expect(engine.log.map(event => event.add)).toEqual([1, 2, 1, 2]);
    expect(processing).toEqual([true, false, true, false]);
    driver.dispose();
  });

  it("aborts at once when the acting seat is handed to a human", async () => {
    const seatsRef = { current: bothBots };
    const { engine, processing, driver } = attach(seatsRef, STEP_WINDOW_MS);

    driver.update(engine.state, seatsRef.current);
    await waitFor("the first step", () => engine.log.length === 1);

    seatsRef.current = { a: { kind: "heuristic" }, b: { kind: "human" } };
    driver.update(engine.state, seatsRef.current);
    expect(processing).toEqual([true, false]);

    const stepsAfterSwap = engine.log.length;
    await sleep(STEP_WINDOW_MS * 3);
    expect(engine.log.length).toBe(stepsAfterSwap);
    driver.dispose();
  });

  it("animates only the other players' events before syncing", async () => {
    const seatsRef = { current: bothBots };
    const engine = makeEngine();
    const played: P[][] = [];
    const order: string[] = [];
    const driver = createSeatDriver<G>({
      game,
      engineRef: { current: engine },
      controllerFor: botAdder,
      logger: () => {},
      animation: {
        play: events => {
          played.push(events.map(event => event.playerId));
          order.push("animate");
          return Promise.resolve();
        },
      },
      stepDelayMs: 0,
      onSync: () => order.push("sync"),
      getSeats: () => seatsRef.current,
      setProcessing: () => {},
      localPlayerId: () => "a",
    });

    driver.update(engine.state, seatsRef.current);
    await waitFor("the game to end", () => engine.state.over);

    expect(played).toEqual([[], ["b"], [], ["b"], []]);
    expect(order.slice(0, 2)).toEqual(["animate", "sync"]);
    driver.dispose();
  });
});
