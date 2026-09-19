import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { render } from "preact";
import type { MutableRef } from "preact/hooks";
import { DominionEngine } from "../engine";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { useSeatDriver } from "./use-seat-driver";
import {
  appMode$,
  gameState$,
  isProcessing$,
  seats$,
  syncEngineToSignals,
} from "./game-signals";

beforeAll(() => {
  GlobalRegistrator.register();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

const POLL_MS = 10;
const TIMEOUT_MS = 8000;

async function waitFor(label: string, condition: () => boolean) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

function Probe({
  engineRef,
}: {
  engineRef: MutableRef<DominionEngine | null>;
}) {
  useSeatDriver(engineRef, () => {}, null);
  return null;
}

function mount(engine: DominionEngine) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const engineRef: MutableRef<DominionEngine | null> = { current: engine };
  render(<Probe engineRef={engineRef} />, root);
  return () => {
    render(null, root);
    root.remove();
  };
}

function engineOnAiTurn(): DominionEngine {
  const engine = new DominionEngine();
  engine.startGame(["human", "ai"], undefined, 7);
  engine.endPhase("human");
  engine.endPhase("human");
  return engine;
}

describe("useSeatDriver", () => {
  afterEach(() => {
    gameState$.value = null;
    seats$.value = {};
  });

  it(
    "plays the rules bot's turn and stops when the human must act",
    async () => {
      const engine = engineOnAiTurn();
      appMode$.value = "local";
      seats$.value = { human: HUMAN_SEAT, ai: HEURISTIC_SEAT };
      const unmount = mount(engine);
      syncEngineToSignals(engine);
      try {
        expect(gameState$.value?.activePlayerId).toBe("ai");
        await waitFor(
          "the bot's turn to end",
          () => gameState$.value?.activePlayerId === "human",
        );
        await waitFor("processing to clear", () => !isProcessing$.value);
        expect(gameState$.value?.turn).toBe(3);
      } finally {
        unmount();
      }
    },
    TIMEOUT_MS,
  );

  it(
    "stops driving when the acting seat becomes human",
    async () => {
      const engine = engineOnAiTurn();
      appMode$.value = "local";
      seats$.value = { human: HUMAN_SEAT, ai: HEURISTIC_SEAT };
      const unmount = mount(engine);
      syncEngineToSignals(engine);
      try {
        await waitFor(
          "the first bot step",
          () => engine.eventLog.length > 0 && isProcessing$.value,
        );
        seats$.value = { human: HUMAN_SEAT, ai: HUMAN_SEAT };
        await waitFor("processing to clear", () => !isProcessing$.value);
        const stepsAfterSwap = engine.eventLog.length;
        await new Promise(resolve => setTimeout(resolve, 700));
        expect(engine.eventLog.length).toBe(stepsAfterSwap);
        expect(gameState$.value?.activePlayerId).toBe("ai");
      } finally {
        unmount();
      }
    },
    TIMEOUT_MS,
  );
});
