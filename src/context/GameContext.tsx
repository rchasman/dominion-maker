/**
 * Single-Player Game Context - Event-Sourced using DominionEngine
 *
 * Uses the same event-sourced engine as multiplayer for consistency.
 * Strategies (engine/llm/hybrid) work with the event system.
 */

import {
  createContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { useSyncToLocalStorage } from "../hooks/useSyncToLocalStorage";
import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import type { GameMode, GameStrategy } from "../types/game-mode";
import { GAME_MODE_CONFIG, getPlayersForMode } from "../types/game-mode";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings, ModelProvider } from "../agent/game-agent";
import {
  DEFAULT_MODEL_SETTINGS,
  abortOngoingConsensus,
} from "../agent/game-agent";
import { DominionEngine } from "../engine";
import { isActionCard, isTreasureCard } from "../data/cards";
import { EngineStrategy } from "../strategies/engine-strategy";
import { MakerStrategy } from "../strategies/maker-strategy";
import { uiLogger } from "../lib/logger";
import { resetPlayerColors } from "../lib/board-utils";
import { api } from "../api/client";

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
  playerStrategies: Record<string, string>;

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

// Re-export for hooks module
export { GameContext, LLMLogsContext };

export function GameProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<DominionEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [gameMode, setGameModeState] = useState<GameMode>("engine");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Track loading state
  const [llmLogs, setLLMLogs] = useState<LLMLogEntry[]>([]);
  const [modelSettings, setModelSettingsState] = useState<ModelSettings>(
    DEFAULT_MODEL_SETTINGS,
  );
  const [playerStrategies, setPlayerStrategies] = useState<
    Record<string, string>
  >({});
  const lastFetchedTurn = useRef<number>(-1);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const savedEvents = localStorage.getItem(STORAGE_EVENTS_KEY);
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
      const savedLogs = localStorage.getItem(STORAGE_LLM_LOGS_KEY);
      const savedSettings = localStorage.getItem(STORAGE_MODEL_SETTINGS_KEY);

      if (
        savedMode &&
        (savedMode === "engine" ||
          savedMode === "maker" ||
          savedMode === "hybrid" ||
          savedMode === "full" ||
          savedMode === "llm")
      ) {
        // Migrate old "maker" to "hybrid"
        const mode: GameMode = savedMode === "maker" ? "hybrid" : savedMode;
        setGameModeState(mode);
      }

      if (savedLogs) {
        setLLMLogs(JSON.parse(savedLogs));
      }

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
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
        uiLogger.info(`Restored game from ${parsedEvents.length} events`);
      }
    } catch (error) {
      uiLogger.error("Failed to restore game state", { error });
      localStorage.removeItem(STORAGE_EVENTS_KEY);
      localStorage.removeItem(STORAGE_MODE_KEY);
      localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
      localStorage.removeItem(STORAGE_MODEL_SETTINGS_KEY);
    } finally {
      setIsLoading(false); // Done loading
    }
  }, []);

  // Sync state to localStorage (skips initial hydration)
  useSyncToLocalStorage(STORAGE_EVENTS_KEY, events, {
    shouldSync: events.length > 0,
  });

  useSyncToLocalStorage(STORAGE_MODE_KEY, gameMode);

  useSyncToLocalStorage(STORAGE_LLM_LOGS_KEY, llmLogs, {
    shouldSync: llmLogs.length > 0,
  });

  useSyncToLocalStorage(
    STORAGE_MODEL_SETTINGS_KEY,
    {
      enabledModels: Array.from(modelSettings.enabledModels),
      consensusCount: modelSettings.consensusCount,
    },
    {
      shouldSync: true,
    },
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortOngoingConsensus();
    };
  }, []);

  // LLM Logger
  const llmLogger = useCallback(
    (entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
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
    },
    [],
  );

  // Strategy
  const strategy: GameStrategy = useMemo(() => {
    if (gameMode === "engine") {
      return new EngineStrategy();
    } else {
      // Both hybrid and full modes use MAKER strategy
      return new MakerStrategy("openai", llmLogger, modelSettings);
    }
  }, [gameMode, llmLogger, modelSettings]);

  // Wrap setGameMode to handle side effects synchronously
  const setGameMode = useCallback((mode: GameMode) => {
    // Abort ongoing consensus and reset processing when mode changes
    // Game state is preserved - just the strategy changes
    abortOngoingConsensus();
    setIsProcessing(false);
    setGameModeState(mode);
  }, []);

  // Fetch strategy analysis on turn completion
  const fetchStrategyAnalysis = useCallback(async (state: GameState) => {
    // Only fetch after turn 2 and if we haven't fetched for this turn yet
    if (
      state.turn < 3 ||
      state.gameOver ||
      lastFetchedTurn.current === state.turn
    ) {
      return;
    }

    lastFetchedTurn.current = state.turn;

    uiLogger.info(
      `🔍 Fetching strategy analysis for turn ${state.turn}...`,
    );

    const { data, error } = await api.api["analyze-strategy"].post({
      currentState: state,
    });

    if (error) {
      uiLogger.warn("Failed to fetch strategy analysis:", error);
      return;
    }

    if (data?.strategySummary) {
      uiLogger.info(
        "✅ Strategy analysis received:",
        data.strategySummary,
      );

      const strategies: Record<string, string> = {};
      const lines = data.strategySummary.split("\n");

      for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(.+)$/);
        if (match) {
          const [, player, strategy] = match;
          const playerKey = player.trim().toLowerCase();

          if (playerKey === "you") {
            strategies[state.activePlayer] = strategy.trim();
          } else if (playerKey === "opponent") {
            const opponentId = Object.keys(state.players).find(
              id => id !== state.activePlayer,
            );
            if (opponentId) strategies[opponentId] = strategy.trim();
          } else {
            const matchedPlayerId = Object.keys(state.players).find(
              id => id.toLowerCase() === playerKey,
            );
            if (matchedPlayerId) {
              strategies[matchedPlayerId] = strategy.trim();
            }
          }
        }
      }

      uiLogger.info("📊 Parsed strategies:", strategies);
      setPlayerStrategies(strategies);
    }
  }, []);

  // Subscribe to engine events to fetch strategy on turn completion
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const unsubscribe = engine.subscribe((events, state) => {
      // Check if any TURN_ENDED event occurred
      const hasTurnEnded = events.some(e => e.type === "TURN_ENDED");
      if (hasTurnEnded) {
        void fetchStrategyAnalysis(state);
      }
    });

    return unsubscribe;
  }, [fetchStrategyAnalysis]);

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
    setPlayerStrategies({});
    lastFetchedTurn.current = -1;
    resetPlayerColors(); // Reset color assignments for new game

    const engine = new DominionEngine();
    engineRef.current = engine;

    // Determine players based on game mode
    const players =
      gameMode === "multiplayer"
        ? ["human", "ai"]
        : getPlayersForMode(gameMode);

    const result = engine.dispatch({
      type: "START_GAME",
      players,
      kingdomCards: undefined, // Will use random 10
    });

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    } else {
      uiLogger.error("Failed to start game", { error: result.error });
    }
  }, [gameMode]);

  // Game actions - all dispatch commands to engine
  const playAction = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch(
      {
        type: "PLAY_ACTION",
        player: "human",
        card,
      },
      "human",
    );

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const playTreasure = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch(
      {
        type: "PLAY_TREASURE",
        player: "human",
        card,
      },
      "human",
    );

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const unplayTreasure = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch(
      {
        type: "UNPLAY_TREASURE",
        player: "human",
        card,
      },
      "human",
    );

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
      const result = engine.dispatch(
        {
          type: "PLAY_TREASURE",
          player: "human",
          card: treasure,
        },
        "human",
      );

      if (!result.ok) {
        uiLogger.error(`Failed to play ${treasure}`, { error: result.error });
      }
    }

    setEvents([...engine.eventLog]);
    setGameState(engine.state);

    return { ok: true, events: [] };
  }, [gameState]);

  const buyCard = useCallback((card: CardName): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch(
      {
        type: "BUY_CARD",
        player: "human",
        card,
      },
      "human",
    );

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const endPhase = useCallback((): CommandResult => {
    const engine = engineRef.current;
    if (!engine) return { ok: false, error: "No engine" };

    const result = engine.dispatch(
      {
        type: "END_PHASE",
        player: "human",
      },
      "human",
    );

    if (result.ok) {
      setEvents([...engine.eventLog]);
      setGameState(engine.state);
    }

    return result;
  }, []);

  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      const engine = engineRef.current;
      if (!engine) return { ok: false, error: "No engine" };

      const result = engine.dispatch(
        {
          type: "SUBMIT_DECISION",
          player: "human",
          choice,
        },
        "human",
      );

      if (result.ok) {
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }

      return result;
    },
    [],
  );

  const requestUndo = useCallback((toEventId: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    // In single-player, undo immediately (no consensus needed)
    engine.undoToEvent(toEventId);
    const eventsAfterUndo = engine.eventLog.length;
    setEvents([...engine.eventLog]);
    setGameState(engine.state);

    // Clear LLM logs that were created after the undo point
    setLLMLogs(prev =>
      prev.filter(log => {
        const logEventCount = log.data?.eventCount;
        // Keep logs that were created when event count was <= current count
        return (
          logEventCount === undefined ||
          (typeof logEventCount === "number" &&
            logEventCount <= eventsAfterUndo)
        );
      }),
    );
  }, []);

  const getStateAtEvent = useCallback(
    (eventId: string): GameState => {
      const engine = engineRef.current;
      if (!engine) return gameState!;

      return engine.getStateAtEvent(eventId);
    },
    [gameState],
  );

  // Auto-run AI turn using strategy
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;

    // Check if current active player is an AI player based on game mode
    const isAITurn =
      gameMode !== "multiplayer" &&
      GAME_MODE_CONFIG[gameMode].isAIPlayer(gameState.activePlayer);

    if (!isAITurn) return;

    const engine = engineRef.current;
    if (!engine) return;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      try {
        await strategy.runAITurn(engine, state => {
          setGameState(state);
        });
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      } catch (error) {
        uiLogger.error("AI turn error", { error });
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, isProcessing, strategy, gameMode]);

  // Auto-resolve opponent decisions during turn (e.g., AI responding to Militia attack)
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;
    if (gameState.subPhase !== "opponent_decision") return;

    // Check if pending decision is for an AI player based on game mode
    const isAIDecision =
      gameMode !== "multiplayer" &&
      gameState.pendingDecision?.player &&
      GAME_MODE_CONFIG[gameMode].isAIPlayer(gameState.pendingDecision.player);

    if (!isAIDecision) return;

    const engine = engineRef.current;
    if (!engine) return;

    const timer = setTimeout(async () => {
      setIsProcessing(true);
      try {
        await strategy.resolveAIPendingDecision(engine);
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      } catch (error) {
        uiLogger.error("AI pending decision error", { error });
      } finally {
        setIsProcessing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [gameState, isProcessing, strategy, gameMode]);

  // Auto-transition to buy phase when human has no actions to play
  useEffect(() => {
    if (!gameState || isProcessing) return;

    const engine = engineRef.current;
    if (!engine) return;

    // Use engine to check if auto-advance should happen
    if (engine.shouldAutoAdvancePhase("human")) {
      const timer = setTimeout(() => {
        uiLogger.info("Auto-transitioning to buy phase (no playable actions)");
        engine.dispatch({ type: "END_PHASE", player: "human" }, "human");
        setEvents([...engine.eventLog]);
        setGameState(engine.state);
      }, 300); // Small delay to make it feel natural

      return () => clearTimeout(timer);
    }
  }, [gameState, isProcessing]);

  const gameValue: GameContextValue = useMemo(
    () => ({
      gameState,
      events,
      gameMode,
      isProcessing,
      isLoading,
      modelSettings,
      playerStrategies,
      hasPlayableActions: hasPlayableActionsValue,
      hasTreasuresInHand: hasTreasuresInHandValue,
      strategy,
      setGameMode,
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
    }),
    [
      gameState,
      events,
      gameMode,
      isProcessing,
      isLoading,
      modelSettings,
      playerStrategies,
      hasPlayableActionsValue,
      hasTreasuresInHandValue,
      strategy,
      setGameMode,
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
    ],
  );

  const llmLogsValue: LLMLogsContextValue = useMemo(
    () => ({
      llmLogs,
    }),
    [llmLogs],
  );

  return (
    <GameContext.Provider value={gameValue}>
      <LLMLogsContext.Provider value={llmLogsValue}>
        {children}
      </LLMLogsContext.Provider>
    </GameContext.Provider>
  );
}
