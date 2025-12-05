import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import type { GameState, CardName } from "../types/game-state";
import type { GameMode, GameStrategy } from "../types/game-mode";
import type { LLMLogEntry } from "../components/LLMLog";
import type { ModelSettings, ModelProvider } from "../agent/game-agent";
import { DEFAULT_MODEL_SETTINGS, abortOngoingConsensus } from "../agent/game-agent";
import { initializeGame } from "../lib/game-init";
import { hasPlayableActions } from "../lib/game-engine/actions";
import { hasTreasuresInHand } from "../lib/game-engine/treasures";
import { endActionPhase } from "../lib/game-engine/phases";
import { EngineStrategy } from "../strategies/engine-strategy";
import { LLMStrategy } from "../strategies/llm-strategy";
import { HybridStrategy } from "../strategies/hybrid-strategy";

const STORAGE_KEY = "dominion-maker-game-state";
const STORAGE_MODE_KEY = "dominion-maker-game-mode";
const STORAGE_LLM_LOGS_KEY = "dominion-maker-llm-logs";
const STORAGE_MODEL_SETTINGS_KEY = "dominion-maker-model-settings";

interface GameContextState {
  gameState: GameState | null;
  selectedCards: CardName[];
  gameMode: GameMode;
  isProcessing: boolean;
  llmLogs: LLMLogEntry[];
  modelSettings: ModelSettings;
}

type GameAction =
  | { type: "SET_GAME_STATE"; payload: GameState | null }
  | { type: "SET_SELECTED_CARDS"; payload: CardName[] }
  | { type: "SET_GAME_MODE"; payload: GameMode }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "ADD_LLM_LOG"; payload: LLMLogEntry }
  | { type: "CLEAR_LLM_LOGS" }
  | { type: "SET_MODEL_SETTINGS"; payload: ModelSettings }
  | { type: "RESTORE_STATE"; payload: Partial<GameContextState> };

function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case "SET_GAME_STATE":
      return { ...state, gameState: action.payload };
    case "SET_SELECTED_CARDS":
      return { ...state, selectedCards: action.payload };
    case "SET_GAME_MODE":
      return { ...state, gameMode: action.payload };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    case "ADD_LLM_LOG":
      return { ...state, llmLogs: [...state.llmLogs, action.payload] };
    case "CLEAR_LLM_LOGS":
      return { ...state, llmLogs: [] };
    case "SET_MODEL_SETTINGS":
      return { ...state, modelSettings: action.payload };
    case "RESTORE_STATE":
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

const initialState: GameContextState = {
  gameState: null,
  selectedCards: [],
  gameMode: "engine",
  isProcessing: false,
  llmLogs: [],
  modelSettings: DEFAULT_MODEL_SETTINGS,
};

interface GameContextValue {
  gameState: GameState | null;
  selectedCards: CardName[];
  gameMode: GameMode;
  isProcessing: boolean;
  modelSettings: ModelSettings;

  // Derived state
  hasPlayableActions: boolean;
  hasTreasuresInHand: boolean;
  strategy: GameStrategy;

  // Actions
  setGameState: (state: GameState | null) => void;
  setGameMode: (mode: GameMode) => void;
  setModelSettings: (settings: ModelSettings) => void;
  startGame: () => void;
  handleCardClick: (card: CardName, index: number) => Promise<void>;
  handleBuyCard: (card: CardName) => Promise<void>;
  handlePlayAllTreasures: () => Promise<void>;
  handleInPlayClick: (card: CardName, index: number) => Promise<void>;
  handleEndPhase: () => Promise<void>;
}

interface LLMLogsContextValue {
  llmLogs: LLMLogEntry[];
}

const GameContext = createContext<GameContextValue | null>(null);
const LLMLogsContext = createContext<LLMLogsContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const modeRestoredFromStorage = useRef(false);
  const settingsRestoredFromStorage = useRef(false);
  const gameSessionId = useRef(0);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
      const savedLogs = localStorage.getItem(STORAGE_LLM_LOGS_KEY);
      const savedSettings = localStorage.getItem(STORAGE_MODEL_SETTINGS_KEY);

      const restored: Partial<GameContextState> = {};

      if (savedState) {
        restored.gameState = JSON.parse(savedState);
      }

      if (savedMode && (savedMode === "engine" || savedMode === "llm" || savedMode === "hybrid")) {
        modeRestoredFromStorage.current = true;
        restored.gameMode = savedMode;
      }

      if (savedLogs) {
        restored.llmLogs = JSON.parse(savedLogs);
      }

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        settingsRestoredFromStorage.current = true;
        restored.modelSettings = {
          enabledModels: new Set(parsed.enabledModels as ModelProvider[]),
          consensusCount: parsed.consensusCount,
        };
      }

      if (Object.keys(restored).length > 0) {
        dispatch({ type: "RESTORE_STATE", payload: restored });
      }
    } catch (error) {
      console.error("Failed to restore game state:", error);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_MODE_KEY);
      localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
      localStorage.removeItem(STORAGE_MODEL_SETTINGS_KEY);
    }
  }, []);

  // Save game state
  useEffect(() => {
    if (state.gameState) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.gameState));
      } catch (error) {
        console.error("Failed to save game state:", error);
      }
    }
  }, [state.gameState]);

  // Save game mode
  useEffect(() => {
    if (modeRestoredFromStorage.current) {
      modeRestoredFromStorage.current = false;
      return;
    }
    localStorage.setItem(STORAGE_MODE_KEY, state.gameMode);
  }, [state.gameMode]);

  // Save LLM logs
  useEffect(() => {
    if (state.llmLogs.length > 0) {
      try {
        localStorage.setItem(STORAGE_LLM_LOGS_KEY, JSON.stringify(state.llmLogs));
      } catch (error) {
        console.error("Failed to save LLM logs:", error);
      }
    }
  }, [state.llmLogs]);

  // Save model settings
  useEffect(() => {
    if (settingsRestoredFromStorage.current) {
      settingsRestoredFromStorage.current = false;
      return;
    }
    try {
      const serializable = {
        enabledModels: Array.from(state.modelSettings.enabledModels),
        consensusCount: state.modelSettings.consensusCount,
      };
      localStorage.setItem(STORAGE_MODEL_SETTINGS_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error("Failed to save model settings:", error);
    }
  }, [state.modelSettings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortOngoingConsensus();
    };
  }, []);

  // LLM Logger
  const llmLogger = useCallback((entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
    const logEntry: LLMLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    dispatch({ type: "ADD_LLM_LOG", payload: logEntry });
  }, []);

  // Strategy
  const strategy: GameStrategy = useMemo(() => {
    if (state.gameMode === "engine") {
      return new EngineStrategy();
    } else if (state.gameMode === "llm") {
      return new LLMStrategy("openai", llmLogger, state.modelSettings);
    } else {
      return new HybridStrategy("openai", llmLogger, state.modelSettings);
    }
  }, [state.gameMode, llmLogger, state.modelSettings]);

  // Derived state
  const hasPlayableActionsValue = useMemo(() =>
    state.gameState ? hasPlayableActions(state.gameState) : false,
    [state.gameState]
  );
  const hasTreasuresInHandValue = useMemo(() =>
    state.gameState ? hasTreasuresInHand(state.gameState) : false,
    [state.gameState]
  );

  // Actions
  const setGameState = useCallback((gameState: GameState | null) => {
    dispatch({ type: "SET_GAME_STATE", payload: gameState });
  }, []);

  const setGameMode = useCallback((mode: GameMode) => {
    dispatch({ type: "SET_GAME_MODE", payload: mode });
  }, []);

  const setModelSettings = useCallback((settings: ModelSettings) => {
    dispatch({ type: "SET_MODEL_SETTINGS", payload: settings });
  }, []);

  const startGame = useCallback(() => {
    abortOngoingConsensus();
    gameSessionId.current++;
    dispatch({ type: "SET_PROCESSING", payload: false });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
    dispatch({ type: "SET_GAME_STATE", payload: initializeGame() });
    dispatch({ type: "SET_SELECTED_CARDS", payload: [] });
    dispatch({ type: "CLEAR_LLM_LOGS" });
  }, []);

  const handleCardClick = useCallback(async (card: CardName, _index: number) => {
    if (!state.gameState || state.gameState.activePlayer !== "human" || state.isProcessing) return;

    const sessionId = gameSessionId.current;
    dispatch({ type: "SET_PROCESSING", payload: true });
    try {
      const newState = await strategy.handleCardPlay(state.gameState, card);
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_GAME_STATE", payload: newState });
      }
    } catch (error) {
      console.error("Card play error:", error);
    } finally {
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    }
  }, [state.gameState, state.isProcessing, strategy]);

  const handleBuyCard = useCallback(async (card: CardName) => {
    if (!state.gameState || state.isProcessing) return;

    const sessionId = gameSessionId.current;
    if (state.gameState.pendingDecision?.type === "gain") {
      dispatch({ type: "SET_PROCESSING", payload: true });
      try {
        const newState = await strategy.handleBuyCard(state.gameState, card);
        if (gameSessionId.current === sessionId) {
          dispatch({ type: "SET_GAME_STATE", payload: newState });
        }
      } catch (error) {
        console.error("Buy card error:", error);
      } finally {
        if (gameSessionId.current === sessionId) {
          dispatch({ type: "SET_PROCESSING", payload: false });
        }
      }
      return;
    }

    if (state.gameState.phase !== "buy" || state.gameState.buys < 1) return;

    dispatch({ type: "SET_PROCESSING", payload: true });
    try {
      const newState = await strategy.handleBuyCard(state.gameState, card);
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_GAME_STATE", payload: newState });
      }
    } catch (error) {
      console.error("Buy card error:", error);
    } finally {
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    }
  }, [state.gameState, state.isProcessing, strategy]);

  const handlePlayAllTreasures = useCallback(async () => {
    if (!state.gameState || state.gameState.phase !== "buy" || state.isProcessing) return;

    const sessionId = gameSessionId.current;
    dispatch({ type: "SET_PROCESSING", payload: true });
    try {
      const newState = await strategy.handlePlayAllTreasures(state.gameState);
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_GAME_STATE", payload: newState });
      }
    } catch (error) {
      console.error("Play all treasures error:", error);
    } finally {
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    }
  }, [state.gameState, state.isProcessing, strategy]);

  const handleInPlayClick = useCallback(async (card: CardName, _index: number) => {
    if (!state.gameState || state.gameState.phase !== "buy" || state.isProcessing) return;

    const sessionId = gameSessionId.current;
    dispatch({ type: "SET_PROCESSING", payload: true });
    try {
      const newState = await strategy.handleUnplayTreasure(state.gameState, card);
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_GAME_STATE", payload: newState });
      }
    } catch (error) {
      console.error("Unplay treasure error:", error);
    } finally {
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    }
  }, [state.gameState, state.isProcessing, strategy]);

  const handleEndPhase = useCallback(async () => {
    if (!state.gameState || state.isProcessing) return;

    const sessionId = gameSessionId.current;
    dispatch({ type: "SET_PROCESSING", payload: true });
    try {
      const newState = await strategy.handleEndPhase(state.gameState);
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_GAME_STATE", payload: newState });
      }
    } catch (error) {
      console.error("End phase error:", error);
    } finally {
      if (gameSessionId.current === sessionId) {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    }
  }, [state.gameState, state.isProcessing, strategy]);

  // Auto-run AI turn and auto-skip
  useEffect(() => {
    if (!state.gameState || state.gameState.gameOver || state.isProcessing) return;

    if (state.gameState.activePlayer === "ai") {
      const sessionId = gameSessionId.current;
      const timer = setTimeout(async () => {
        dispatch({ type: "SET_PROCESSING", payload: true });
        try {
          const newState = await strategy.runAITurn(state.gameState!, setGameState);
          if (gameSessionId.current === sessionId) {
            dispatch({ type: "SET_GAME_STATE", payload: newState });
          }
        } catch (error) {
          console.error("AI turn error:", error);
        } finally {
          if (gameSessionId.current === sessionId) {
            dispatch({ type: "SET_PROCESSING", payload: false });
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    if (state.gameState.subPhase === "opponent_decision" && state.gameState.pendingDecision?.player === "ai") {
      const sessionId = gameSessionId.current;
      const timer = setTimeout(async () => {
        dispatch({ type: "SET_PROCESSING", payload: true });
        try {
          const newState = await strategy.resolveAIPendingDecision(state.gameState!);
          if (gameSessionId.current === sessionId) {
            dispatch({ type: "SET_GAME_STATE", payload: newState });
          }
        } catch (error) {
          console.error("AI pending decision error:", error);
        } finally {
          if (gameSessionId.current === sessionId) {
            dispatch({ type: "SET_PROCESSING", payload: false });
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    if (state.gameState.activePlayer === "human" &&
        state.gameState.phase === "action" &&
        !state.gameState.pendingDecision &&
        !hasPlayableActions(state.gameState)) {
      dispatch({ type: "SET_GAME_STATE", payload: endActionPhase(state.gameState) });
    }
  }, [state.gameState, state.isProcessing, strategy, setGameState]);

  const gameValue: GameContextValue = useMemo(() => ({
      gameState: state.gameState,
      selectedCards: state.selectedCards,
      gameMode: state.gameMode,
      isProcessing: state.isProcessing,
      modelSettings: state.modelSettings,
      hasPlayableActions: hasPlayableActionsValue,
      hasTreasuresInHand: hasTreasuresInHandValue,
      strategy,
      setGameState,
      setGameMode,
      setModelSettings,
      startGame,
      handleCardClick,
      handleBuyCard,
      handlePlayAllTreasures,
      handleInPlayClick,
      handleEndPhase,
  }), [
    state.gameState,
    state.selectedCards,
    state.gameMode,
    state.isProcessing,
    state.modelSettings,
    hasPlayableActionsValue,
    hasTreasuresInHandValue,
    strategy,
    setGameState,
    setGameMode,
    setModelSettings,
    startGame,
    handleCardClick,
    handleBuyCard,
    handlePlayAllTreasures,
    handleInPlayClick,
    handleEndPhase,
  ]);

  const llmLogsValue: LLMLogsContextValue = useMemo(() => ({
    llmLogs: state.llmLogs,
  }), [state.llmLogs]);

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
