/**
 * Custom hook for strategy analysis
 * Fetches and stores strategy analysis after turns
 */

import { useEffect } from "react";
import type { DominionEngine } from "../engine";
import type { GameStrategy } from "../types/game-mode";
import { uiLogger } from "../lib/logger";
import { MIN_TURN_FOR_STRATEGY } from "./game-constants";

type PlayerStrategyData = Record<
  string,
  {
    gameplan: string;
    read: string;
    lines: string;
  }
>;

/**
 * Fetch strategy analysis from API
 */
function fetchStrategyAnalysis(
  state: import("../types/game-state").GameState,
  strategy: GameStrategy,
  setPlayerStrategies: (strategies: PlayerStrategyData) => void,
): void {
  import("../api/client")
    .then(({ api }) => {
      return api.api["analyze-strategy"].post({
        currentState: state,
      });
    })
    .then(({ data, error }) => {
      if (error) {
        uiLogger.warn("Failed to fetch strategy analysis:", error);
        return;
      }

      if (!data?.strategySummary) {
        return;
      }

      const strategies = data.strategySummary as PlayerStrategyData;

      if (Object.keys(strategies).length === 0) {
        return;
      }

      const stringifiedStrategies = JSON.stringify(strategies);
      strategy.setStrategySummary?.(stringifiedStrategies);
      setPlayerStrategies(strategies);
    })
    .catch((err: unknown) => {
      uiLogger.warn("Failed to fetch strategy analysis:", err);
    });
}

/**
 * Hook to subscribe to turn endings and fetch strategy analysis
 */
export function useStrategyAnalysis(
  engineRef: import("react").MutableRefObject<DominionEngine | null>,
  strategy: GameStrategy,
  setPlayerStrategies: (strategies: PlayerStrategyData) => void,
): void {
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      uiLogger.warn("Strategy subscription: no engine");
      return undefined;
    }

    const unsubscribe = engine.subscribe((newEvents, state) => {
      const hasTurnEnded = newEvents.some(e => e.type === "TURN_ENDED");

      if (hasTurnEnded && state.turn >= MIN_TURN_FOR_STRATEGY) {
        fetchStrategyAnalysis(state, strategy, setPlayerStrategies);
      }
    });

    return unsubscribe;
  }, [engineRef, strategy, setPlayerStrategies]);
}
