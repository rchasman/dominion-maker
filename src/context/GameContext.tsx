/**
 * Single-Player Game Context - Event-Sourced using DominionEngine
 *
 * Uses the same event-sourced engine as multiplayer for consistency.
 * Strategies (engine/llm/hybrid) work with the event system.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings, ModelProvider } from "../agent/game-agent";
import { DEFAULT_MODEL_SETTINGS, abortOngoingConsensus } from "../agent/game-agent";
import { DominionEngine } from "../engine";
import { isActionCard, isTreasureCard } from "../data/cards";
import { EngineStrategy } from "../strategies/engine-strategy";
import { MakerStrategy } from "../strategies/maker-strategy";

const STORAGE_EVENTS_KEY = "dominion-maker-sp-events";
const STORAGE_MODE_KEY = "dominion-maker-game-mode";
const STORAGE_LLM_LOGS_KEY = "dominion-maker-llm-logs";
const STORAGE_MODEL_SETTINGS_KEY = "dominion-maker-model-settings";

interface GameContextValue {
  // Game state
  gameState: GameState | null;
  events: GameEvent[];
  gameMode: GameMode;
  isProcessing: boolean;
  isLoading: boolean; // Loading from localStorage
  modelSettings: ModelSettings;

  // Derived state
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  strategy: GameStrategy;

  // Actions
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

const GameContext = createContext<GameContextValue | null>(null);
const LLMLogsContext = createContext<LLMLogsContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<DominionEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [gameMode, setGameModeState] = useState<GameMode>("engine");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Track loading state
  const [llmLogs, setLLMLogs] = useState<LLMLogEntry[]>([]);
  const [modelSettings, setModelSettingsState] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS);
  const modeRestoredFromStorage = useRef(false);
  const settingsRestoredFromStorage = useRef(false);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const savedEvents = localStorage.getItem(STORAGE_EVENTS_KEY);
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
      const savedLogs = localStorage.getItem(STORAGE_LLM_LOGS_KEY);
      const savedSettings = localStorage.getItem(STORAGE_MODEL_SETTINGS_KEY);

      if (savedMode && (savedMode === "engine" || savedMode === "maker" || savedMode === "hybrid")) {
        // Migrate old "hybrid"/"llm" to "maker"
        const mode = (savedMode === "hybrid" || savedMode === "llm") ? "maker" : savedMode;
        modeRestoredFromStorage.current = true;
        setGameModeState(mode);
      }

      if (savedLogs) {
        setLLMLogs(JSON.parse(savedLogs));
      }

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        settingsRestoredFromStorage.current = true;
        setModelSettingsState({
          enabledModels: new Set(parsed.enabledModels as ModelProvider[]),
          consensusCount: parsed.consensusCount,
        });
      }

      if (savedEvents) {
        const parsedEvents = JSON.parse(savedEvents) as GameEvent[];
        const engine = new DominionEngine();
        engine.loadEvents(parsedEvents);
        engineRef.current = engine;
        setEvents(parsedEvents);
        setGameState(engine.state);
        console.log("[GameContext] Restored game from", parsedEvents.length, "events");
      }
    } catch (error) {
      console.error("Failed to restore game state:", error);
      localStorage.removeItem(STORAGE_EVENTS_KEY);
      localStorage.removeItem(STORAGE_MODE_KEY);
      localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
      localStorage.removeItem(STORAGE_MODEL_SETTINGS_KEY);
    } finally {
      setIsLoading(false); // Done loading
    }
  }, []);

  // Save events
  useEffect(() => {
    if (events.length > 0) {
      try {
        localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
      } catch (error) {
        console.error("Failed to save events:", error);
      }
    }
  }, [events]);

  // Save game mode
  useEffect(() => {
    if (modeRestoredFromStorage.current) {
      modeRestoredFromStorage.current = false;
      return;
    }
    localStorage.setItem(STORAGE_MODE_KEY, gameMode);
  }, [gameMode]);

  // Save LLM logs
  useEffect(() => {
    if (llmLogs.length > 0) {
      try {
        localStorage.setItem(STORAGE_LLM_LOGS_KEY, JSON.stringify(llmLogs));
      } catch (error) {
        console.error("Failed to save LLM logs:", error);
      }
    }
  }, [llmLogs]);

  // Save model settings
  useEffect(() => {
    if (settingsRestoredFromStorage.current) {
      settingsRestoredFromStorage.current = false;
      return;
    }
    try {
      const serializable = {
        enabledModels: Array.from(modelSettings.enabledModels),
        consensusCount: modelSettings.consensusCount,
      };
      localStorage.setItem(STORAGE_MODEL_SETTINGS_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error("Failed to save model settings:", error);
    }
  }, [modelSettings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortOngoingConsensus();
    };
  }, []);


  // LLM Logger
  const llmLogger = useCallback((entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
    const engine = engineRef.current;
    const logEntry: LLMLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      data: {
        ...entry.data,
        eventCount: engine?.eventLog.length, // Track event count when log was created
      },
    };
    setLLMLogs(prev => [...prev, logEntry]);
  }, []);

  // Strategy
  const strategy: GameStrategy = useMemo(() => {
    if (gameMode === "engine") {
      return new EngineStrategy();
    } else {
      return new MakerStrategy("openai", llmLogger, modelSettings);
    }
  }, [gameMode, llmLogger, modelSettings]);

  // Derived state
  const hasPlayableActionsValue = useMemo(() => {
    if (!gameState) return false;
    const humanState = gameState.players.human;
    if (!humanState) return false;
    return humanState.hand.some(isActionCard) && gameState.actions > 0;
  }, [gameState]);

  const hasTreasuresInHandValue = useMemo(() => {
    if (!gameState) return false;
    const humanState = gameState.players.human;
    if (!humanState) return false;
    return humanState.hand.some(isTreasureCard);
  }, [gameState]);

  // Start new game
  const startGame = useCallback(() => {
    abortOngoingConsensus();
    setIsProcessing(false);
    localStorage.removeItem(STORAGE_EVENTS_KEY);
    localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
    setLLMLogs([]);

    const engine = new DominionEngine();
    engineRef.current = engine;

    // Start game with human vs AI
    const result = engine.dispatch({
      type: "START_GAME",
      players: ["human", "ai"],
      kingdomCards: undefined, // Will use random 10
    });

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    } else {
      console.error("Failed to start game:", result.error);
    }
  }, []);

  // Game actions - all dispatch commands to engine
  const playAction = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "PLAY_ACTION",
      player: "human",
      card,
    }, "human");

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const playTreasure = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "PLAY_TREASURE",
      player: "human",
      card,
    }, "human");

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const unplayTreasure = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "UNPLAY_TREASURE",
      player: "human",
      card,
    }, "human");

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const playAllTreasures = useCallback((): CommandResult => {
    const engine = engineRef.current;
    if (!engine || !gameState) return { ok: false, error: "No engine" };

    const humanState = gameState.players.human;
    if (!humanState) return { ok: false, error: "No human player" };

    const treasures = humanState.hand.filter(isTreasureCard);

    for (const treasure of treasures) {
      const result = engine.dispatch({
        type: "PLAY_TREASURE",
        player: "human",
        card: treasure,
      }, "human");

      if (!result.ok) {
        console.error(`Failed to play ${treasure}:`, result.error);
      }
    }

    setEvents([...engine.eventLog]);
    setGameState(engine.state);

    return { ok: true, events: [] };
  }, [gameState]);

  const buyCard = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "BUY_CARD",
      player: "human",
      card,
    }, "human");

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const endPhase = useCallback((): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "END_PHASE",
      player: "human",
    }, "human");

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const submitDecision = useCallback((choice: DecisionChoice): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "SUBMIT_DECISION",
      player: "human",
      choice,
    }, "human");

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const requestUndo = useCallback((toEventId: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    // In single-player, undo immediately (no consensus needed)
    engine.undoToEvent(toEventId);
    const eventsAfterUndo = engine.eventLog.length;
    setEvents([...engine.eventLog]);
    setGameState(engine.state);

    // Clear LLM logs that were created after the undo point
    setLLMLogs(prev => prev.filter(log => {
      const logEventCount = log.data?.eventCount;
      // Keep logs that were created when event count was <= current count
      return logEventCount === undefined || (typeof logEventCount === 'number' && logEventCount <= eventsAfterUndo);
    }));
  }, []);

  const getStateAtEvent = useCallback((eventId: string): GameState => {
    const engine = engineRef.current;
    if (!engine) return gameState!;

    return engine.getStateAtEvent(eventId);
  }, [gameState]);

  // Auto-run AI turn using strategy
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;
    if (gameState.activePlayer !== "ai") return;

    const engine = engineRef.current;
    if (!engine) return;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      try {
        await strategy.runAITurn(engine, (state) => {
          setGameState(state);
        });
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      } catch (error) {
        console.error("AI turn error:", error);
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, isProcessing, strategy]);

  // Auto-resolve opponent decisions during turn (e.g., AI responding to Militia attack)
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;
    if (gameState.subPhase !== "opponent_decision") return;
    if (gameState.pendingDecision?.player !== "ai") return;

    const engine = engineRef.current;
    if (!engine) return;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      try {
        await strategy.resolveAIPendingDecision(engine);
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      } catch (error) {
        console.error("AI pending decision error:", error);
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, isProcessing, strategy]);

  // Auto-transition to buy phase when human has no actions to play
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;
    if (gameState.activePlayer !== "human") return;
    if (gameState.phase !== "action") return;
    if (gameState.pendingDecision) return; // Don't auto-transition during decisions

    const engine = engineRef.current;
    if (!engine) return;

    // Check if player can play any actions
    const humanPlayer = gameState.players.human;
    if (!humanPlayer) return;

    const hasActionCards = humanPlayer.hand.some(card => isActionCard(card));
    const hasActions = gameState.actions > 0;

    // Auto-transition if no actions available OR no action cards to play
    if (!hasActions || !hasActionCards) {
      const timer = setTimeout(() => {
        console.log("[GameContext] Auto-transitioning to buy phase (no playable actions)");
        engine.dispatch({ type: "END_PHASE", player: "human" }, "human");
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }, 300); // Small delay to make it feel natural

      return () => clearTimeout(timer);
    }
  }, [gameState, isProcessing]);

  const gameValue: GameContextValue = useMemo(() => ({
    gameState,
    events,
    gameMode,
    isProcessing,
    isLoading,
    modelSettings,
    hasPlayableActions: hasPlayableActionsValue,
    hasTreasuresInHand: hasTreasuresInHandValue,
    strategy,
    setGameMode: setGameModeState,
    setModelSettings: setModelSettingsState,
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
  }), [
    gameState,
    events,
    gameMode,
    isProcessing,
    isLoading,
    modelSettings,
    hasPlayableActionsValue,
    hasTreasuresInHandValue,
    strategy,
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
  ]);

  const llmLogsValue: LLMLogsContextValue = useMemo(() => ({
    llmLogs,
  }), [llmLogs]);

  return (
    <GameContext.Provider value={gameValue}>
      <LLMLogsContext.Provider value={llmLogsValue}>
        {children}
      </LLMLogsContext.Provider>
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

export function useLLMLogs() {
  const context = useContext(LLMLogsContext);
  if (!context) {
    // Return empty logs for multiplayer mode (no GameProvider)
    return { llmLogs: [] };
  }
  return context;
}
