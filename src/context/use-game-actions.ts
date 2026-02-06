/**
 * Custom hook for game action callbacks
 * Writes directly to signals after engine commands.
 */

import type { MutableRef as MutableRefObject } from "preact/hooks";
import { useCallback } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { CardName, GameState } from "../types/game-state";
import type { DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { GameStrategy } from "../types/game-mode";
import { fetchStrategyAnalysis } from "./use-strategy-analysis";
import { MIN_TURN_FOR_STRATEGY } from "./game-constants";
import {
  syncEngineToSignals,
  gameState$,
  llmLogs$,
  playerStrategies$,
} from "./game-signals";
import {
  executePlayAction,
  executePlayTreasure,
  executeUnplayTreasure,
  executePlayAllTreasures,
  executeBuyCard,
  executeEndPhase,
  executeSubmitDecision,
  executeUndo,
  getStateAtEvent as getStateAtEventUtil,
} from "./game-actions";

/**
 * Filter LLM logs after undo
 */
function filterLogsAfterUndo(
  logs: LLMLogEntry[],
  eventsAfterUndo: number,
): LLMLogEntry[] {
  return logs.filter(log => {
    const logEventCount = log.data?.eventCount;
    return (
      logEventCount === undefined ||
      (typeof logEventCount === "number" && logEventCount <= eventsAfterUndo)
    );
  });
}

interface GameActions {
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  unplayTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;
  revealReaction: (card: CardName) => CommandResult;
  declineReaction: () => CommandResult;
  requestUndo: (toEventId: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
}

/**
 * Hook to create all game action callbacks.
 * All actions write directly to signals via syncEngineToSignals.
 */
export function useGameActions(
  engineRef: MutableRefObject<DominionEngine | null>,
  strategy: GameStrategy,
): GameActions {
  const playAction = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executePlayAction(engine, card);
      if (result.ok) {
        syncEngineToSignals(engine);
      }
      return result;
    },
    [engineRef],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executePlayTreasure(engine, card);
      if (result.ok) {
        syncEngineToSignals(engine);
      }
      return result;
    },
    [engineRef],
  );

  const unplayTreasure = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executeUnplayTreasure(engine, card);
      if (result.ok) {
        syncEngineToSignals(engine);
      }
      return result;
    },
    [engineRef],
  );

  const playAllTreasures = useCallback((): CommandResult => {
    const engine = engineRef.current;
    const gs = gameState$.value;
    if (!engine || !gs) {
      return { ok: false, error: "No engine" };
    }

    const result = executePlayAllTreasures(engine, gs);
    syncEngineToSignals(engine);
    return result;
  }, [engineRef]);

  const buyCard = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executeBuyCard(engine, card);
      if (result.ok) {
        syncEngineToSignals(engine);
      }
      return result;
    },
    [engineRef],
  );

  const endPhase = useCallback((): CommandResult => {
    const engine = engineRef.current;
    if (!engine) {
      return { ok: false, error: "No engine" };
    }

    const result = executeEndPhase(engine);
    if (result.ok) {
      syncEngineToSignals(engine);
    }
    return result;
  }, [engineRef]);

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executeSubmitDecision(engine, choice);
      if (result.ok) {
        syncEngineToSignals(engine);
      }
      return result;
    },
    [engineRef],
  );

  const requestUndo = useCallback(
    (toEventId: string) => {
      const engine = engineRef.current;
      if (!engine) {
        return;
      }

      executeUndo(engine, toEventId);
      const eventsAfterUndo = engine.eventLog.length;
      const stateAfterUndo = engine.state;
      syncEngineToSignals(engine);

      llmLogs$.value = filterLogsAfterUndo(llmLogs$.value, eventsAfterUndo);

      // Refetch strategy analysis for the new game state after undo
      if (stateAfterUndo.turn >= MIN_TURN_FOR_STRATEGY) {
        fetchStrategyAnalysis(
          stateAfterUndo,
          strategy,
          playerStrategies$.value,
        );
      }
    },
    [engineRef, strategy],
  );

  const getStateAtEvent = useCallback(
    (eventId: string): GameState => {
      const engine = engineRef.current;
      const gs = gameState$.value;
      if (!engine || !gs) {
        return gs!;
      }

      return getStateAtEventUtil(engine, eventId, gs);
    },
    [engineRef],
  );

  const revealReaction = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      const gs = gameState$.value;
      if (!engine || !gs) {
        return { ok: false, error: "No engine" };
      }

      const defender = gs.pendingChoice?.playerId;
      if (!defender) {
        return { ok: false, error: "No pending reaction" };
      }

      const result = engine.dispatch(
        { type: "REVEAL_REACTION", playerId: defender, card },
        defender,
      );

      if (result.ok) {
        syncEngineToSignals(engine);
      }
      return result;
    },
    [engineRef],
  );

  const declineReaction = useCallback((): CommandResult => {
    const engine = engineRef.current;
    const gs = gameState$.value;
    if (!engine || !gs) {
      return { ok: false, error: "No engine" };
    }

    const defender = gs.pendingChoice?.playerId;
    if (!defender) {
      return { ok: false, error: "No pending reaction" };
    }

    const result = engine.dispatch(
      { type: "DECLINE_REACTION", playerId: defender },
      defender,
    );

    if (result.ok) {
      syncEngineToSignals(engine);
    }
    return result;
  }, [engineRef]);

  return {
    playAction,
    playTreasure,
    unplayTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
    revealReaction,
    declineReaction,
    requestUndo,
    getStateAtEvent,
  };
}
