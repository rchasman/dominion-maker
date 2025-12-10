/**
 * Custom hook for game action callbacks
 * Manages all game command dispatching
 */

import { useCallback, type MutableRefObject } from "react";
import type { DominionEngine } from "../engine";
import type { CardName, GameState } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { LLMLogEntry } from "../components/LLMLog";
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
  },
): GameActions {
  const { setEvents, setGameState, setLLMLogs } = actions;
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
      setEvents([...engine.eventLog]);
      setGameState(engine.state);

      setLLMLogs(prev => filterLogsAfterUndo(prev, eventsAfterUndo));
    },
    [engineRef, setEvents, setGameState, setLLMLogs],
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
