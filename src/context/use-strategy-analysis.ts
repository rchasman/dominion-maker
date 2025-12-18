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

/**
 * Fetch strategy analysis from API
 */
export function fetchStrategyAnalysis(
  state: GameState,
  strategy: GameStrategy,
  currentStrategies: PlayerStrategyData,
  setPlayerStrategies: (strategies: PlayerStrategyData) => void,
): void {
  const hasStrategies = Object.keys(currentStrategies).length > 0;

  api.api["analyze-strategy"]
    .post({
      currentState: state,
      previousAnalysis: hasStrategies ? currentStrategies : undefined,
    })
    .then(({ data, error }) => {
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

      const stringifiedStrategies = JSON.stringify(data.strategySummary);
      strategy.setStrategySummary?.(stringifiedStrategies);
      setPlayerStrategies(data.strategySummary);
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

/**
 * Hook to watch events array and fetch strategy analysis (multiplayer)
 */
export function useStrategyAnalysisFromEvents(
  events: GameEvent[],
  gameState: GameState | null,
  setPlayerStrategies: (strategies: PlayerStrategyData) => void,
): void {
  const lastEventCountRef = useRef(0);

  useEffect(() => {
    if (!gameState || events.length <= lastEventCountRef.current) return;

    const newEvents = events.slice(lastEventCountRef.current);
    lastEventCountRef.current = events.length;

    const hasTurnEnded = newEvents.some(e => e.type === "TURN_ENDED");
    if (!hasTurnEnded || gameState.turn < MIN_TURN_FOR_STRATEGY) return;

    // Multiplayer doesn't use GameStrategy, so we pass empty object
    api.api["analyze-strategy"]
      .post({ currentState: gameState })
      .then(({ data }) => {
        if (data?.strategySummary?.length) {
          const record = data.strategySummary.reduce<PlayerStrategyData>(
            (acc, item) => {
              acc[item.id] = {
                gameplan: item.gameplan,
                read: item.read,
                recommendation: item.recommendation,
              };
              return acc;
            },
            {},
          );
          setPlayerStrategies(record);
        }
      })
      .catch(() => {});
  }, [events, gameState, setPlayerStrategies]);
}
