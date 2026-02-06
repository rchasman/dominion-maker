/**
 * Single-Player Game Provider - Event-Sourced using DominionEngine
 *
 * Initializes the engine, runs effects, and wires up signals.
 * No useState for game state - signals are the primary state owner.
 */

import { useEffect, useRef, useMemo } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { DominionEngine } from "../engine";
import type { LLMLogEntry } from "../components/LLMLog";
import type { GameMode, GameStrategy } from "../types/game-mode";
import { abortOngoingConsensus, type ModelSettings } from "../agent/game-agent";
import { EngineStrategy } from "../strategies/engine-strategy";
import { MakerStrategy } from "../strategies/maker-strategy";
import { useGameActions } from "./use-game-actions";
import {
  useAITurnAutomation,
  useAIDecisionAutomation,
  useAutoPhaseAdvance,
} from "./use-ai-automation";
import { useStrategyAnalysis } from "./use-strategy-analysis";
import { useGameStorage } from "./use-game-storage";
import { useStartGame } from "./use-start-game";
import { useStorageSync } from "./use-storage-sync";
import {
  gameMode$,
  isProcessing$,
  modelSettings$,
  strategy$,
  llmLogs$,
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
  setGameMode$,
  setModelSettings$,
} from "./game-signals";

/**
 * Create LLM log entry with metadata
 */
function createLLMLogEntry(
  entry: Omit<LLMLogEntry, "id" | "timestamp">,
  eventCount: number | undefined,
): LLMLogEntry {
  return {
    ...entry,
    id: `${Date.now()}-${Math.random()}`,
    timestamp: Date.now(),
    data: {
      ...entry.data,
      eventCount,
    },
  };
}

export function GameProvider({ children }: { children: ComponentChildren }) {
  const storage = useGameStorage();
  const engineRef = useRef<DominionEngine | null>(storage.engineRef);
  const setEngine = (engine: DominionEngine | null) => {
    engineRef.current = engine;
  };

  // Read signal values for reactive effects
  const gameMode = gameMode$.value;
  const currentModelSettings = modelSettings$.value;

  const setGameMode = (mode: GameMode) => {
    abortOngoingConsensus();
    isProcessing$.value = false;
    gameMode$.value = mode;
  };

  const setModelSettingsFn = (settings: Partial<ModelSettings>) => {
    modelSettings$.value = { ...modelSettings$.value, ...settings };
  };

  // Sync to localStorage (reads from signals)
  useStorageSync();

  // LLM Logger - stable reference that reads current engine when called
  const llmLoggerRef = useRef(
    (entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
      const engine = engineRef.current;
      const logEntry = createLLMLogEntry(entry, engine?.eventLog.length);
      llmLogs$.value = [...llmLogs$.value, logEntry];
    },
  );

  // Strategy - create strategy instance without logger to avoid ref access during render
  const strategy: GameStrategy = useMemo(() => {
    if (gameMode === "engine") {
      return new EngineStrategy();
    }
    // Create MakerStrategy without logger initially
    return new MakerStrategy("openai", undefined, currentModelSettings);
  }, [gameMode, currentModelSettings]);

  // Set logger on strategy after creation (outside of render)
  useEffect(() => {
    if (strategy instanceof MakerStrategy) {
      const loggerFn = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
        llmLoggerRef.current(entry);
      };
      strategy.setLogger(loggerFn);
    }
  }, [strategy]);

  // Write strategy and config actions to signals
  strategy$.value = strategy;
  setGameMode$.value = setGameMode;
  setModelSettings$.value = setModelSettingsFn;

  // Strategy analysis
  useStrategyAnalysis(engineRef, strategy);

  // Start new game
  const startGame = useStartGame(setEngine);

  // Game actions (writes to signals directly)
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
  } = useGameActions(engineRef, strategy);

  // Write action callbacks to signals
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

  // AI Automation (reads from signals directly)
  useAITurnAutomation({
    gameMode,
    strategy,
    engineRef,
  });

  useAIDecisionAutomation({
    gameMode,
    strategy,
    engineRef,
  });

  useAutoPhaseAdvance(engineRef);

  return <>{children}</>;
}
