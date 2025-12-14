/**
 * Custom hook for strategy analysis
 * Fetches and stores strategy analysis after turns
 */

import type { MutableRef as MutableRefObject } from "preact/hooks";
import { useEffect } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { GameStrategy } from "../types/game-mode";
import type { GameState } from "../types/game-state";
import type { PlayerStrategyData } from "../types/player-strategy";
import { api } from "../api/client";
import { uiLogger } from "../lib/logger";
import { MIN_TURN_FOR_STRATEGY } from "./game-constants";

/**
 * Fetch strategy analysis from API
 */
export function fetchStrategyAnalysis(
  state: GameState,
  strategy: GameStrategy,
  currentStrategies: PlayerStrategyData,
  setPlayerStrategies: (strategies: PlayerStrategyData) => void,
): void {
  api.api["analyze-strategy"]
    .post({
      currentState: state,
      previousAnalysis:
        currentStrategies.length > 0 ? currentStrategies : undefined,
    })
    .then(({ data, error }) => {
      if (error) {
        uiLogger.warn("Failed to fetch strategy analysis:", error);
        return;
      }

      if (!data?.strategySummary || data.strategySummary.length === 0) {
        return;
      }

      const stringifiedStrategies = JSON.stringify(data.strategySummary);
      strategy.setStrategySummary?.(stringifiedStrategies);
      setPlayerStrategies(data.strategySummary);
    })
    .catch((err: unknown) => {
      uiLogger.warn("Failed to fetch strategy analysis:", err);
    });
}

/**
 * Hook to subscribe to turn endings and fetch strategy analysis
 */
export function useStrategyAnalysis(
  engineRef: MutableRefObject<DominionEngine | null>,
  strategy: GameStrategy,
  currentStrategies: PlayerStrategyData,
  setPlayerStrategies: (strategies: PlayerStrategyData) => void,
): void {
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      uiLogger.warn("Strategy subscription: no engine");
      return;
    }

    const unsubscribe = engine.subscribe((newEvents, state) => {
      const hasTurnEnded = newEvents.some(e => e.type === "TURN_ENDED");

      if (hasTurnEnded && state.turn >= MIN_TURN_FOR_STRATEGY) {
        fetchStrategyAnalysis(
          state,
          strategy,
          currentStrategies,
          setPlayerStrategies,
        );
      }
    });

    return unsubscribe;
  }, [engineRef, strategy, currentStrategies, setPlayerStrategies]);
}
