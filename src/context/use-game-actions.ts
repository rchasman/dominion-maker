/**
 * Custom hook for game action callbacks
 * Manages all game command dispatching
 */

import { useCallback } from "preact/hooks";
import type { DominionEngine } from "../engine";
import type { CardName, GameState } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { LLMLogEntry } from "../components/LLMLog";
import type { GameStrategy } from "../types/game-mode";
import type { PlayerStrategyData } from "../types/player-strategy";
import { fetchStrategyAnalysis } from "./use-strategy-analysis";
import { MIN_TURN_FOR_STRATEGY } from "./game-constants";
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
  requestUndo: (toEventId: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
}

/**
 * Hook to create all game action callbacks
 */

export function useGameActions(
  engineRef: MutableRefObject<DominionEngine | null>,
  gameState: GameState | null,
  actions: {
    setEvents: (events: GameEvent[]) => void;
    setGameState: (state: GameState) => void;
    setLLMLogs: (setter: (prev: LLMLogEntry[]) => LLMLogEntry[]) => void;
    strategy: GameStrategy;
    playerStrategies: PlayerStrategyData;
    setPlayerStrategies: (strategies: PlayerStrategyData) => void;
  },
): GameActions {
  const {
    setEvents,
    setGameState,
    setLLMLogs,
    strategy,
    playerStrategies,
    setPlayerStrategies,
  } = actions;
  const playAction = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executePlayAction(engine, card);
      if (result.ok) {
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }
      return result;
    },
    [engineRef, setEvents, setGameState],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executePlayTreasure(engine, card);
      if (result.ok) {
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }
      return result;
    },
    [engineRef, setEvents, setGameState],
  );

  const unplayTreasure = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executeUnplayTreasure(engine, card);
      if (result.ok) {
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }
      return result;
    },
    [engineRef, setEvents, setGameState],
  );

  const playAllTreasures = useCallback((): CommandResult => {
    const engine = engineRef.current;
    if (!engine || !gameState) {
      return { ok: false, error: "No engine" };
    }

    const result = executePlayAllTreasures(engine, gameState);
    setEvents([...engine.eventLog]);
    setGameState(engine.state);
    return result;
  }, [engineRef, gameState, setEvents, setGameState]);

  const buyCard = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executeBuyCard(engine, card);
      if (result.ok) {
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }
      return result;
    },
    [engineRef, setEvents, setGameState],
  );

  const endPhase = useCallback((): CommandResult => {
    const engine = engineRef.current;
    if (!engine) {
      return { ok: false, error: "No engine" };
    }

    const result = executeEndPhase(engine);
    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }
    return result;
  }, [engineRef, setEvents, setGameState]);

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      const engine = engineRef.current;
      if (!engine) {
        return { ok: false, error: "No engine" };
      }

      const result = executeSubmitDecision(engine, choice);
      if (result.ok) {
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }
      return result;
    },
    [engineRef, setEvents, setGameState],
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
      setEvents([...engine.eventLog]);
      setGameState(stateAfterUndo);

      setLLMLogs(prev => filterLogsAfterUndo(prev, eventsAfterUndo));

      // Refetch strategy analysis for the new game state after undo
      if (stateAfterUndo.turn >= MIN_TURN_FOR_STRATEGY) {
        fetchStrategyAnalysis(
          stateAfterUndo,
          strategy,
          playerStrategies,
          setPlayerStrategies,
        );
      }
    },
    [
      engineRef,
      setEvents,
      setGameState,
      setLLMLogs,
      strategy,
      playerStrategies,
      setPlayerStrategies,
    ],
  );

  const getStateAtEvent = useCallback(
    (eventId: string): GameState => {
      const engine = engineRef.current;
      if (!engine || !gameState) {
        const fallback: GameState = gameState ?? ({} satisfies GameState);
        return fallback;
      }

      return getStateAtEventUtil(engine, eventId, gameState);
    },
    [engineRef, gameState],
  );

  return {
    playAction,
    playTreasure,
    unplayTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
    requestUndo,
    getStateAtEvent,
  };
}
