/**
 * Single-Player Game Provider - Event-Sourced using DominionEngine
 *
 * Initializes the engine, runs effects, and wires up signals.
 * No useState for game state - signals are the primary state owner.
 */

import { useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { DominionEngine } from "../engine";
import type { LLMLogEntry } from "../components/LLMLog";
import type { LLMLogEntryInput, LLMLogger } from "../core/consensus/types";
import { useGameActions } from "./use-game-actions";
import { useSeatDriver } from "./use-seat-driver";
import { useAutoEndActionPhase } from "./use-auto-end-action-phase";
import { useStrategyAnalysis } from "./use-strategy-analysis";
import { useGameStorage } from "./use-game-storage";
import { useStartGame } from "./use-start-game";
import { useStorageSync } from "./use-storage-sync";
import { useAnimationSafe } from "../animation";
import {
  appMode$,
  llmLogs$,
  localHumanSeat$,
  playAction$,
  playTreasure$,
  unplayTreasure$,
  playAllTreasures$,
  buyCard$,
  endPhase$,
  submitDecision$,
  revealReaction$,
  declineReaction$,
  requestUndo$,
  getStateAtEvent$,
  startGame$,
  setSeat$,
  updateSeat,
} from "./game-signals";

function createLLMLogEntry(
  entry: LLMLogEntryInput,
  eventCount: number | undefined,
): LLMLogEntry {
  return {
    ...entry,
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    data: { ...entry.data, eventCount },
  };
}

export function GameProvider({ children }: { children: ComponentChildren }) {
  const storage = useGameStorage();
  const engineRef = useRef<DominionEngine | null>(storage.engineRef);
  const setEngine = (engine: DominionEngine | null) => {
    engineRef.current = engine;
  };

  appMode$.value = "local";

  // Sync to localStorage (reads from signals)
  useStorageSync();

  // LLM Logger - stable reference that reads current engine when called
  const loggerRef = useRef<LLMLogger>(entry => {
    const engine = engineRef.current;
    llmLogs$.value = [
      ...llmLogs$.value,
      createLLMLogEntry(entry, engine?.eventLog.length),
    ];
  });

  setSeat$.value = updateSeat;

  useStrategyAnalysis(engineRef);

  const startGame = useStartGame(setEngine);

  const {
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
  } = useGameActions(engineRef);

  startGame$.value = startGame;
  playAction$.value = playAction;
  playTreasure$.value = playTreasure;
  unplayTreasure$.value = unplayTreasure;
  playAllTreasures$.value = playAllTreasures;
  buyCard$.value = buyCard;
  endPhase$.value = endPhase;
  submitDecision$.value = submitDecision;
  revealReaction$.value = revealReaction;
  declineReaction$.value = declineReaction;
  requestUndo$.value = requestUndo;
  getStateAtEvent$.value = getStateAtEvent;

  useSeatDriver(engineRef, loggerRef.current, useAnimationSafe());
  useAutoEndActionPhase({
    localPlayerId: localHumanSeat$.value,
    endPhase: () => {
      endPhase();
    },
  });

  return <>{children}</>;
}
