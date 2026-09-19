import { afterEach, describe, expect, it } from "bun:test";
import { effect } from "@preact/signals";
import { DominionEngine } from "../engine";
import { HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
import { createSeatDriver } from "./seat-driver";
import {
  appMode$,
  gameState$,
  isProcessing$,
  seats$,
  syncEngineToSignals,
} from "./game-signals";

const POLL_MS = 10;
const TIMEOUT_MS = 15000;
const SWAP_WINDOW_MS = 300;

async function waitFor(label: string, condition: () => boolean) {
  const deadline = Date.now() + TIMEOUT_MS;
  while (!condition()) {
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${label}`);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

function engineOnAiTurn(): DominionEngine {
  const engine = new DominionEngine();
  engine.startGame(["human", "ai"], undefined, 7);
  engine.endPhase("human");
  engine.endPhase("human");
  return engine;
}

/** Wire the driver the way the hook does: every state or seats change calls update */
function attach(engine: DominionEngine, stepDelayMs: number) {
  const driver = createSeatDriver({
    engineRef: { current: engine },
    logger: () => {},
    animation: null,
    stepDelayMs,
  });
  const stopEffect = effect(() => {
    driver.update(gameState$.value, seats$.value);
  });
  return () => {
    stopEffect();
    driver.dispose();
  };
}

// One sequential test: the driver reads module-level signals, so two tests
// running concurrently (bun test --concurrent) would swap each other's seats.
describe("createSeatDriver", () => {
  afterEach(() => {
    gameState$.value = null;
    seats$.value = {};
    isProcessing$.value = false;
  });

  it(
    "plays the bot's turn, stops for the human, and stops when a seat is handed to a human",
    async () => {
      appMode$.value = "local";

      // Phase 1: a full rules-bot turn with no step delay
      const fast = engineOnAiTurn();
      seats$.value = { human: HUMAN_SEAT, ai: HEURISTIC_SEAT };
      const detachFast = attach(fast, 0);
      syncEngineToSignals(fast);
      try {
        await waitFor(
          "the bot's turn to end",
          () => gameState$.value?.activePlayerId === "human",
        );
        await waitFor("processing to clear", () => !isProcessing$.value);
        expect(gameState$.value?.turn).toBe(3);
      } finally {
        detachFast();
      }

      // Phase 2: hand the acting seat to a human between steps
      const slow = engineOnAiTurn();
      seats$.value = { human: HUMAN_SEAT, ai: HEURISTIC_SEAT };
      const detachSlow = attach(slow, SWAP_WINDOW_MS);
      syncEngineToSignals(slow);
      try {
        await waitFor(
          "the first bot step",
          () => slow.eventLog.length > 0 && isProcessing$.value,
        );
        seats$.value = { human: HUMAN_SEAT, ai: HUMAN_SEAT };
        await waitFor("processing to clear", () => !isProcessing$.value);
        const stepsAfterSwap = slow.eventLog.length;
        await new Promise(resolve => setTimeout(resolve, SWAP_WINDOW_MS + 200));
        expect(slow.eventLog.length).toBe(stepsAfterSwap);
        expect(gameState$.value?.activePlayerId).toBe("ai");
      } finally {
        detachSlow();
      }
    },
    TIMEOUT_MS,
  );
});
