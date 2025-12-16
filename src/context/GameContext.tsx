/**
 * Single-Player Game Context - Event-Sourced using DominionEngine
 *
 * Uses the same event-sourced engine as multiplayer for consistency.
 * Strategies (engine/llm/hybrid) work with the event system.
 */

import { useState, useEffect, useRef, useMemo } from "preact/hooks";
import { createContext, type ComponentChildren } from "preact";
import type { GameState, CardName } from "../types/game-state";
import type { DominionEngine } from "../engine";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { LLMLogEntry } from "../components/LLMLog";
import { abortOngoingConsensus, type ModelSettings } from "../agent/game-agent";
import { EngineStrategy } from "../strategies/engine-strategy";
import { MakerStrategy } from "../strategies/maker-strategy";
import { useGameActions } from "./use-game-actions";
import {
  hasPlayableActions as computeHasPlayableActions,
  hasTreasuresInHand as computeHasTreasuresInHand,
} from "./derived-state";
import {
  useAITurnAutomation,
  useAIDecisionAutomation,
  useAutoPhaseAdvance,
} from "./use-ai-automation";
import { useStrategyAnalysis } from "./use-strategy-analysis";
import { useGameStorage } from "./use-game-storage";
import { useStartGame } from "./use-start-game";
import { useStorageSync } from "./use-storage-sync";

interface GameContextValue {
  gameState: GameState | null;
  events: GameEvent[];
  gameMode: GameMode;
  isProcessing: boolean;
  isLoading: boolean;
  modelSettings: ModelSettings;
  playerStrategies: PlayerStrategyData;
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  strategy: GameStrategy;
  localPlayerId?: string | null; // For multiplayer: which player slot you're in
  localPlayerName?: string; // Display name of the local player
  spectatorCount?: number; // Number of spectators watching the game
  chatMessages?: Array<{
    id: string;
    senderName: string;
    content: string;
    timestamp: number;
  }>;
  sendChat?: (message: {
    id: string;
    senderName: string;
    content: string;
    timestamp: number;
  }) => void;
  setGameMode: (mode: GameMode) => void;
  setModelSettings: (settings: ModelSettings) => void;
  startGame: () => void;
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

interface LLMLogsContextValue {
  llmLogs: LLMLogEntry[];
}

import type { PlayerStrategyData } from "../types/player-strategy";

const GameContext = createContext<GameContextValue | null>(null);
const LLMLogsContext = createContext<LLMLogsContextValue | null>(null);

export { GameContext, LLMLogsContext };

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
  const engineRef = useRef<DominionEngine | null>(null);
  const setEngine = (engine: DominionEngine | null) => {
    engineRef.current = engine;
  };

  const [gameState, setGameState] = useState<GameState | null>(
    storage.gameState,
  );
  const [events, setEvents] = useState<GameEvent[]>(storage.events);
  const [gameMode, setGameModeInternal] = useState<GameMode>(storage.gameMode);
  const [isProcessing, setIsProcessing] = useState(false);
  const [llmLogs, setLLMLogs] = useState<LLMLogEntry[]>(storage.llmLogs);
  const [modelSettings, setModelSettings] = useState<ModelSettings>(
    storage.modelSettings,
  );
  const [playerStrategies, setPlayerStrategies] = useState<PlayerStrategyData>(
    storage.playerStrategies,
  );

  const setGameMode = (mode: GameMode) => {
    abortOngoingConsensus();
    setIsProcessing(false);
    setGameModeInternal(mode);
  };

  // Sync engine ref with storage on mount
  useEffect(() => {
    if (storage.engineRef) {
      engineRef.current = storage.engineRef;
    }
  }, [storage.engineRef, engineRef]);

  // Sync to localStorage
  useStorageSync({
    events,
    gameMode,
    llmLogs,
    modelSettings,
    playerStrategies,
  });

  // LLM Logger - stable reference that reads current engine when called
  const llmLoggerRef = useRef(
    (entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
      const engine = engineRef.current;
      const logEntry = createLLMLogEntry(entry, engine?.eventLog.length);
      setLLMLogs(prev => [...prev, logEntry]);
    },
  );

  // Strategy - create strategy instance without logger to avoid ref access during render
  const strategy: GameStrategy = useMemo(() => {
    if (gameMode === "engine") {
      return new EngineStrategy();
    }
    // Create MakerStrategy without logger initially
    return new MakerStrategy("openai", undefined, modelSettings);
  }, [gameMode, modelSettings]);

  // Set logger on strategy after creation (outside of render)
  useEffect(() => {
    if (strategy instanceof MakerStrategy) {
      const loggerFn = (entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
        llmLoggerRef.current(entry);
      };
      strategy.setLogger(loggerFn);
    }
  }, [strategy]);

  // Strategy analysis
  useStrategyAnalysis(
    engineRef,
    strategy,
    playerStrategies,
    setPlayerStrategies,
  );

  // Derived state
  const hasPlayableActionsValue = useMemo(
    () => computeHasPlayableActions(gameState),
    [gameState],
  );

  const hasTreasuresInHandValue = useMemo(
    () => computeHasTreasuresInHand(gameState),
    [gameState],
  );

  // Start new game
  const startGame = useStartGame(gameMode, {
    setEngine,
    setEvents,
    setGameState,
    setLLMLogs,
    setPlayerStrategies,
  });

  // Game actions
  const {
    playAction,
    playTreasure,
    unplayTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
    requestUndo,
    getStateAtEvent,
  } = useGameActions(engineRef, gameState, {
    setEvents,
    setGameState,
    setLLMLogs,
    strategy,
    playerStrategies,
    setPlayerStrategies,
  });

  // AI Automation
  useAITurnAutomation({
    gameState,
    isProcessing,
    gameMode,
    strategy,
    engineRef,
    setIsProcessing,
    setEvents,
    setGameState,
  });

  useAIDecisionAutomation({
    gameState,
    isProcessing,
    gameMode,
    strategy,
    engineRef,
    setIsProcessing,
    setEvents,
    setGameState,
  });

  useAutoPhaseAdvance(gameState, isProcessing, engineRef, {
    setEvents,
    setGameState,
  });

  return (
    <GameContext.Provider
      value={{
        gameState,
        events,
        gameMode,
        isProcessing,
        isLoading: storage.isLoading,
        modelSettings,
        playerStrategies,
        hasPlayableActions: hasPlayableActionsValue,
        hasTreasuresInHand: hasTreasuresInHandValue,
        strategy,
        setGameMode,
        setModelSettings,
        startGame,
        playAction,
        playTreasure,
        unplayTreasure,
        playAllTreasures,
        buyCard,
        endPhase,
        submitDecision,
        requestUndo,
        getStateAtEvent,
      }}
    >
      <LLMLogsContext.Provider value={{ llmLogs }}>
        {children}
      </LLMLogsContext.Provider>
    </GameContext.Provider>
  );
}
