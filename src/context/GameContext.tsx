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
import type { GameMode } from "../types/game-mode";
import type { ModelSettings } from "../agent/types";
import type { ControllerConfig } from "../core/seats";
import { DEFAULT_LLM_SEAT, HEURISTIC_SEAT, HUMAN_SEAT } from "../core/seats";
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
  gameState$,
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
  seats$,
  setGameMode$,
  setModelSettings$,
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

// Transitional: the sidebar still switches "modes"; a mode is a table shape.
function seatForMode(mode: GameMode, index: number): ControllerConfig {
  if (mode === "full") return DEFAULT_LLM_SEAT;
  if (index === 0) return HUMAN_SEAT;
  return mode === "engine" ? HEURISTIC_SEAT : DEFAULT_LLM_SEAT;
}

function applyModelSettings(
  seat: ControllerConfig,
  settings: Partial<ModelSettings>,
): ControllerConfig {
  if (seat.kind !== "llm") return seat;
  return {
    ...seat,
    ...(settings.enabledModels !== undefined && {
      models: [...settings.enabledModels],
    }),
    ...(settings.consensusCount !== undefined && {
      consensusCount: settings.consensusCount,
    }),
    ...(settings.customStrategy !== undefined && {
      customStrategy: settings.customStrategy,
    }),
  };
}

export function GameProvider({ children }: { children: ComponentChildren }) {
  const storage = useGameStorage();
  const engineRef = useRef<DominionEngine | null>(storage.engineRef);
  const setEngine = (engine: DominionEngine | null) => {
    engineRef.current = engine;
  };

  appMode$.value = "local";

  const setGameMode = (mode: GameMode) => {
    const order = gameState$.peek()?.playerOrder ?? [];
    seats$.value = Object.fromEntries(
      order.map((id, index) => [id, seatForMode(mode, index)]),
    );
  };

  const setModelSettingsFn = (settings: Partial<ModelSettings>) => {
    seats$.value = Object.fromEntries(
      Object.entries(seats$.value).map(([id, seat]) => [
        id,
        applyModelSettings(seat, settings),
      ]),
    );
  };

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

  setGameMode$.value = setGameMode;
  setModelSettings$.value = setModelSettingsFn;
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
