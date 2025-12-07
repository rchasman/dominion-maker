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
import type { GameState, CardName, Player } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { GameMode } from "../types/game-mode";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings, ModelProvider } from "../agent/game-agent";
import { DEFAULT_MODEL_SETTINGS, abortOngoingConsensus } from "../agent/game-agent";
import { DominionEngine } from "../engine";
import { isActionCard, isTreasureCard, CARDS } from "../data/cards";

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
  modelSettings: ModelSettings;

  // Derived state
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;

  // Actions
  setGameMode: (mode: GameMode) => void;
  setModelSettings: (settings: ModelSettings) => void;
  startGame: () => void;
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;
  requestUndo: (toEventId: string, reason?: string) => void;
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

      if (savedMode && (savedMode === "engine" || savedMode === "llm" || savedMode === "hybrid")) {
        modeRestoredFromStorage.current = true;
        setGameModeState(savedMode);
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
      }
    } catch (error) {
      console.error("Failed to restore game state:", error);
      localStorage.removeItem(STORAGE_EVENTS_KEY);
      localStorage.removeItem(STORAGE_MODE_KEY);
      localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
      localStorage.removeItem(STORAGE_MODEL_SETTINGS_KEY);
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

  // Subscribe to engine events
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const listener = (newEvents: GameEvent[], newState: GameState) => {
      setEvents(engine.events);
      setGameState(newState);
    };

    engine.subscribe(listener);
    return () => {
      // No unsubscribe in current engine implementation
    };
  }, [engineRef.current]);

  // LLM Logger
  const llmLogger = useCallback((entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
    const logEntry: LLMLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    setLLMLogs(prev => [...prev, logEntry]);
  }, []);


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
      playerIds: ["human", "ai"],
      kingdomCards: undefined, // Will use random 10
    });

    if (result.ok) {
      setEvents(engine.events);
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
      card,
    }, "human");

    if (result.ok) {
      setEvents(engine.events);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const playTreasure = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "PLAY_TREASURE",
      card,
    }, "human");

    if (result.ok) {
      setEvents(engine.events);
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
        card: treasure,
      }, "human");

      if (!result.ok) {
        console.error(`Failed to play ${treasure}:`, result.error);
      }
    }

    setEvents(engine.events);
    setGameState(engine.state);

    return { ok: true };
  }, [gameState]);

  const buyCard = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "BUY_CARD",
      card,
    }, "human");

    if (result.ok) {
      setEvents(engine.events);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const endPhase = useCallback((): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "END_PHASE",
    }, "human");

    if (result.ok) {
      setEvents(engine.events);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const submitDecision = useCallback((choice: DecisionChoice): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch({
      type: "SUBMIT_DECISION",
      choice,
    }, "human");

    if (result.ok) {
      setEvents(engine.events);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const requestUndo = useCallback((toEventId: string, _reason?: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    // In single-player, undo immediately (no consensus needed)
    engine.undoToEvent(toEventId);
    setEvents(engine.events);
    setGameState(engine.state);
  }, []);

  const getStateAtEvent = useCallback((eventId: string): GameState => {
    const engine = engineRef.current;
    if (!engine) return gameState!;

    return engine.getStateAtEvent(eventId);
  }, [gameState]);

  // Auto-run AI turn - simple random AI for now
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;
    if (gameState.activePlayer !== "ai") return;

    const engine = engineRef.current;
    if (!engine) return;

    const timer = setTimeout(() => {
      setIsProcessing(true);
      try {
        // Simple AI: play all actions, play all treasures, buy random affordable card, end turn
        const aiState = gameState.players.ai;
        if (!aiState) return;

        // Action phase: play all actions
        if (gameState.phase === "action") {
          const actions = aiState.hand.filter(isActionCard);
          for (const action of actions) {
            if (gameState.actions > 0) {
              engine.dispatch({ type: "PLAY_ACTION", card: action }, "ai");
            }
          }
          engine.dispatch({ type: "END_PHASE" }, "ai");
        }

        // Buy phase: play all treasures, buy random card, end
        if (gameState.phase === "buy") {
          const treasures = aiState.hand.filter(isTreasureCard);
          for (const treasure of treasures) {
            engine.dispatch({ type: "PLAY_TREASURE", card: treasure }, "ai");
          }

          // Buy a random affordable card
          const affordable = Object.entries(gameState.supply)
            .filter(([_card, count]) => count > 0)
            .filter(([card]) => CARDS[card as CardName].cost <= gameState.coins)
            .map(([card]) => card as CardName);

          if (affordable.length > 0 && gameState.buys > 0) {
            const randomCard = affordable[Math.floor(Math.random() * affordable.length)];
            engine.dispatch({ type: "BUY_CARD", card: randomCard }, "ai");
          }

          engine.dispatch({ type: "END_PHASE" }, "ai");
        }

        setEvents(engine.events);
        setGameState(engine.state);
      } catch (error) {
        console.error("AI turn error:", error);
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, isProcessing]);

  // Auto-resolve AI pending decisions - pick first valid option
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;
    if (gameState.pendingDecision?.player !== "ai") return;

    const engine = engineRef.current;
    if (!engine) return;

    const timer = setTimeout(() => {
      setIsProcessing(true);
      try {
        const decision = gameState.pendingDecision;
        if (!decision) return;

        // Simple AI: pick first N valid options (or random subset)
        const options = decision.cardOptions || [];
        const numToPick = Math.min(decision.min, options.length);
        const selectedCards = options.slice(0, numToPick);

        engine.dispatch({
          type: "SUBMIT_DECISION",
          choice: { selectedCards },
        }, "ai");

        setEvents(engine.events);
        setGameState(engine.state);
      } catch (error) {
        console.error("AI pending decision error:", error);
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, isProcessing]);

  const gameValue: GameContextValue = useMemo(() => ({
    gameState,
    events,
    gameMode,
    isProcessing,
    modelSettings,
    hasPlayableActions: hasPlayableActionsValue,
    hasTreasuresInHand: hasTreasuresInHandValue,
    setGameMode: setGameModeState,
    setModelSettings: setModelSettingsState,
    startGame,
    playAction,
    playTreasure,
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
    modelSettings,
    hasPlayableActionsValue,
    hasTreasuresInHandValue,
    startGame,
    playAction,
    playTreasure,
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
    throw new Error("useLLMLogs must be used within a GameProvider");
  }
  return context;
}
