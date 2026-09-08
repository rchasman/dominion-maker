import { afterEach, expect, it } from "bun:test";
import { createGame } from "../engine";
import { api } from "../api/client";
import {
  fetchStrategyAnalysis,
  invalidateStrategyAnalysis,
} from "./use-strategy-analysis";
import { gameState$, playerStrategies$ } from "./game-signals";

const originalPost = api.api["analyze-strategy"].post;
afterEach(() => {
  api.api["analyze-strategy"].post = originalPost;
  invalidateStrategyAnalysis();
  gameState$.value = null;
  playerStrategies$.value = {};
});

it("keeps the newest analysis when responses arrive in reverse order", async () => {
  const queue: {
    pending: Array<(value: Awaited<ReturnType<typeof originalPost>>) => void>;
  } = { pending: [] };
  api.api["analyze-strategy"].post = () =>
    new Promise(resolve => {
      queue.pending = [...queue.pending, resolve];
    });
  const state = createGame(["human", "ai"], undefined, 42).state;
  gameState$.value = state;
  const first = fetchStrategyAnalysis(state, undefined, {});
  const second = fetchStrategyAnalysis(state, undefined, {});
  const result = (gameplan: string) => ({
    data: {
      strategySummary: {
        human: { gameplan, read: "read", recommendation: "recommendation" },
      },
    },
    error: null,
  });
  queue.pending[1]!(result("new"));
  await second;
  queue.pending[0]!(result("old"));
  await first;
  expect(playerStrategies$.value.human?.gameplan).toBe("new");
  expect(playerStrategies$.value.human?.analysis?.turn).toBe(state.turn);
});

it("rejects an in-flight response after a new game or undo invalidates it", async () => {
  const response: {
    resolve?: (value: Awaited<ReturnType<typeof originalPost>>) => void;
  } = {};
  api.api["analyze-strategy"].post = () =>
    new Promise(done => {
      response.resolve = done;
    });
  const state = createGame(["human", "ai"], undefined, 42).state;
  gameState$.value = state;
  const pending = fetchStrategyAnalysis(state, undefined, {});
  invalidateStrategyAnalysis();
  response.resolve!({
    data: {
      strategySummary: {
        human: {
          gameplan: "obsolete",
          read: "read",
          recommendation: "recommendation",
        },
      },
    },
    error: null,
  });
  await pending;
  expect(playerStrategies$.value).toEqual({});
});
