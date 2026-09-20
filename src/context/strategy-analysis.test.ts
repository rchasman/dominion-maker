import { afterEach, expect, it } from "bun:test";
import { signal } from "@preact/signals";
import type { GameState } from "../types/game-state";
import type { PlayerStrategyData } from "../types/player-strategy";
import { createGame } from "../engine";
import { api } from "../api/client";
import { createStrategyAnalyzer } from "./strategy-analysis";

const originalPost = api.api["analyze-strategy"].post;
afterEach(() => {
  api.api["analyze-strategy"].post = originalPost;
});

const analyzerFor = (state: GameState) => {
  const gameState = signal<GameState | null>(state);
  const playerStrategies = signal<PlayerStrategyData>({});
  return {
    playerStrategies,
    analyzer: createStrategyAnalyzer({ gameState, playerStrategies }),
  };
};

const result = (gameplan: string) => ({
  data: {
    strategySummary: {
      human: { gameplan, read: "read", recommendation: "recommendation" },
    },
  },
  error: null,
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
  const { analyzer, playerStrategies } = analyzerFor(state);
  const first = analyzer.fetch(state);
  const second = analyzer.fetch(state);
  queue.pending[1]!(result("new"));
  await second;
  queue.pending[0]!(result("old"));
  await first;
  expect(playerStrategies.value.human?.gameplan).toBe("new");
  expect(playerStrategies.value.human?.analysis?.turn).toBe(state.turn);
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
  const { analyzer, playerStrategies } = analyzerFor(state);
  const pending = analyzer.fetch(state);
  analyzer.invalidate();
  response.resolve!(result("obsolete"));
  await pending;
  expect(playerStrategies.value).toEqual({});
});

it("keeps each session's requests apart", async () => {
  const response: {
    resolve?: (value: Awaited<ReturnType<typeof originalPost>>) => void;
  } = {};
  api.api["analyze-strategy"].post = () =>
    new Promise(done => {
      response.resolve = done;
    });
  const state = createGame(["human", "ai"], undefined, 42).state;
  const first = analyzerFor(state);
  const second = analyzerFor(state);
  const pending = first.analyzer.fetch(state);
  second.analyzer.invalidate();
  response.resolve!(result("first"));
  await pending;
  expect(first.playerStrategies.value.human?.gameplan).toBe("first");
  expect(second.playerStrategies.value).toEqual({});
});
