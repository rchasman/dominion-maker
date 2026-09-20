/**
 * Strategy analysis for one session: fetched after each turn past the
 * threshold, written into the session's playerStrategies signal. LLM seats
 * read that signal on every decision, so nothing else needs telling.
 */

import type { ReadonlySignal, Signal } from "@preact/signals";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import { api } from "../api/client";
import { uiLogger } from "../lib/logger";
import { MIN_TURN_FOR_STRATEGY } from "./game-constants";
import {
  analysisVersion,
  isAnalysisApplicable,
} from "../agent/analysis-version";

type StrategyAnalyzer = {
  /** Drop every in-flight response: a new game or an undo made them stale */
  readonly invalidate: () => void;
  readonly fetch: (state: GameState) => Promise<void>;
  /** Call with each batch of new events; fetches when a turn just ended */
  readonly onEvents: (
    newEvents: readonly GameEvent[],
    state: GameState,
  ) => void;
};

const turnEndedPastThreshold = (
  newEvents: readonly GameEvent[],
  state: GameState,
): boolean =>
  newEvents.some(e => e.type === "TURN_ENDED") &&
  state.turn >= MIN_TURN_FOR_STRATEGY;

export function createStrategyAnalyzer(deps: {
  gameState: ReadonlySignal<GameState | null>;
  playerStrategies: Signal<PlayerStrategyData>;
}): StrategyAnalyzer {
  const { gameState, playerStrategies } = deps;
  const requests = { latest: 0 };

  const fetch = (state: GameState): Promise<void> => {
    const request = ++requests.latest;
    const version = analysisVersion(state);
    const current = playerStrategies.peek();
    const hasStrategies = Object.keys(current).length > 0;

    return api.api["analyze-strategy"]
      .post({
        currentState: state,
        ...(hasStrategies && { previousAnalysis: current }),
      })
      .then(({ data, error }) => {
        const currentState = gameState.peek();
        if (
          request !== requests.latest ||
          !currentState ||
          !isAnalysisApplicable(version, currentState)
        )
          return;
        if (error) {
          uiLogger.warn("Failed to fetch strategy analysis:", error);
          return;
        }
        if (
          !data?.strategySummary ||
          Object.keys(data.strategySummary).length === 0
        )
          return;

        playerStrategies.value = Object.fromEntries(
          Object.entries(data.strategySummary).map(([id, analysis]) => [
            id,
            { ...analysis, analysis: version },
          ]),
        );
      })
      .catch((err: unknown) => {
        uiLogger.warn("Failed to fetch strategy analysis:", err);
      });
  };

  return {
    invalidate() {
      requests.latest++;
    },
    fetch,
    onEvents(newEvents, state) {
      if (turnEndedPastThreshold(newEvents, state)) void fetch(state);
    },
  };
}
