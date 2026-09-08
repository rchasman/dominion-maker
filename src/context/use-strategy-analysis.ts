/**
 * Custom hooks for strategy analysis
 * Fetches and stores strategy analysis after turns
 */

import type { MutableRef as MutableRefObject } from "preact/hooks";
import { useEffect, useRef } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { GameStrategy } from "../types/game-mode";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { PlayerStrategyData } from "../types/player-strategy";
import { api } from "../api/client";
import { uiLogger } from "../lib/logger";
import { MIN_TURN_FOR_STRATEGY } from "./game-constants";
import { playerStrategies$, gameState$, events$ } from "./game-signals";
import {
  analysisVersion,
  isAnalysisApplicable,
} from "../agent/analysis-version";

const analysisRequests = { latest: 0 };
export function invalidateStrategyAnalysis(): void {
  analysisRequests.latest++;
}

/**
 * True when a turn just ended and the game is past the analysis threshold
 */
function turnEndedPastThreshold(
  newEvents: GameEvent[],
  state: GameState,
): boolean {
  return (
    newEvents.some(e => e.type === "TURN_ENDED") &&
    state.turn >= MIN_TURN_FOR_STRATEGY
  );
}

/**
 * Fetch strategy analysis from API and write to playerStrategies$ signal.
 * Multiplayer has no GameStrategy, so strategy is optional.
 */
export function fetchStrategyAnalysis(
  state: GameState,
  strategy: GameStrategy | undefined,
  currentStrategies: PlayerStrategyData,
): Promise<void> {
  const request = ++analysisRequests.latest;
  const version = analysisVersion(state);
  const hasStrategies = Object.keys(currentStrategies).length > 0;

  return api.api["analyze-strategy"]
    .post({
      currentState: state,
      ...(hasStrategies && { previousAnalysis: currentStrategies }),
    })
    .then(({ data, error }) => {
      const currentState = gameState$.peek();
      if (
        request !== analysisRequests.latest ||
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
      ) {
        return;
      }

      const versioned = Object.fromEntries(
        Object.entries(data.strategySummary).map(([id, analysis]) => [
          id,
          { ...analysis, analysis: version },
        ]),
      );
      const stringifiedStrategies = JSON.stringify(versioned);
      strategy?.setStrategySummary?.(stringifiedStrategies);
      playerStrategies$.value = versioned;
    })
    .catch((err: unknown) => {
      uiLogger.warn("Failed to fetch strategy analysis:", err);
    });
}

/**
 * Hook to subscribe to turn endings and fetch strategy analysis (single-player with engine)
 */
export function useStrategyAnalysis(
  engineRef: MutableRefObject<DominionEngine | null>,
  strategy: GameStrategy,
): void {
  const gameIdentity = events$.value[0]?.id;
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) {
      uiLogger.warn("Strategy subscription: no engine");
      return;
    }

    strategy.setStrategySummary?.(JSON.stringify(playerStrategies$.peek()));
    const unsubscribe = engine.subscribe((newEvents, state) => {
      if (turnEndedPastThreshold(newEvents, state)) {
        void fetchStrategyAnalysis(state, strategy, playerStrategies$.value);
      }
    });

    return () => {
      unsubscribe();
      invalidateStrategyAnalysis();
    };
  }, [engineRef, strategy, gameIdentity]);
}

/**
 * Hook to watch events array and fetch strategy analysis (multiplayer)
 */
export function useStrategyAnalysisFromEvents(
  events: GameEvent[],
  gameState: GameState | null,
): void {
  const lastEventCountRef = useRef(0);
  const gameIdentityRef = useRef<string | undefined>();

  useEffect(() => {
    const identity = events[0]?.id;
    if (
      identity !== gameIdentityRef.current ||
      events.length < lastEventCountRef.current
    ) {
      invalidateStrategyAnalysis();
      lastEventCountRef.current = 0;
      gameIdentityRef.current = identity;
    }
    if (!gameState || events.length <= lastEventCountRef.current) return;

    const newEvents = events.slice(lastEventCountRef.current);
    lastEventCountRef.current = events.length;

    if (!turnEndedPastThreshold(newEvents, gameState)) return;

    // Multiplayer has no GameStrategy to notify
    void fetchStrategyAnalysis(gameState, undefined, playerStrategies$.value);
  }, [events, gameState]);
}
