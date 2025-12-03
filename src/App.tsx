import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { GameState, CardName } from "./types/game-state";
import type { GameMode, GameStrategy } from "./types/game-mode";
import { initializeGame } from "./lib/game-init";
import { hasPlayableActions } from "./lib/game-engine/actions";
import { hasTreasuresInHand } from "./lib/game-engine/treasures";
import { endActionPhase } from "./lib/game-engine/phases";
import { Board } from "./components/Board";
import { EngineStrategy } from "./strategies/engine-strategy";
import { LLMStrategy } from "./strategies/llm-strategy";
import { HybridStrategy } from "./strategies/hybrid-strategy";
import type { LLMLogEntry } from "./components/LLMLog";
import type { ModelSettings, ModelProvider } from "./agent/game-agent";
import { DEFAULT_MODEL_SETTINGS, abortOngoingConsensus } from "./agent/game-agent";

const STORAGE_KEY = "dominion-maker-game-state";
const STORAGE_MODE_KEY = "dominion-maker-game-mode";
const STORAGE_LLM_LOGS_KEY = "dominion-maker-llm-logs";
const STORAGE_MODEL_SETTINGS_KEY = "dominion-maker-model-settings";

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<CardName[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("engine");
  const [isProcessing, setIsProcessing] = useState(false);
  const [llmLogs, setLlmLogs] = useState<LLMLogEntry[]>([]);
  const [modelSettings, setModelSettings] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS);
  const modeRestoredFromStorage = useRef(false);
  const settingsRestoredFromStorage = useRef(false);

  // Restore game state from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
      const savedLogs = localStorage.getItem(STORAGE_LLM_LOGS_KEY);
      const savedSettings = localStorage.getItem(STORAGE_MODEL_SETTINGS_KEY);

      if (savedState) {
        const parsed = JSON.parse(savedState);
        setGameState(parsed);
      }

      if (savedMode && (savedMode === "engine" || savedMode === "llm" || savedMode === "hybrid")) {
        modeRestoredFromStorage.current = true;
        setGameMode(savedMode);
      }

      if (savedLogs) {
        const parsedLogs = JSON.parse(savedLogs);
        setLlmLogs(parsedLogs);
      }

      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        // Convert enabledModels array back to Set
        const settings: ModelSettings = {
          enabledModels: new Set(parsed.enabledModels as ModelProvider[]),
          consensusCount: parsed.consensusCount,
        };
        settingsRestoredFromStorage.current = true;
        setModelSettings(settings);
      }
    } catch (error) {
      console.error("Failed to restore game state:", error);
      // Clear corrupted data
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_MODE_KEY);
      localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
      localStorage.removeItem(STORAGE_MODEL_SETTINGS_KEY);
    }
  }, []);

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    if (gameState) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
      } catch (error) {
        console.error("Failed to save game state:", error);
      }
    }
  }, [gameState]);

  // Save game mode to localStorage whenever it changes (skip restoration echo)
  useEffect(() => {
    if (modeRestoredFromStorage.current) {
      modeRestoredFromStorage.current = false;
      return;
    }
    localStorage.setItem(STORAGE_MODE_KEY, gameMode);
  }, [gameMode]);

  // Save LLM logs to localStorage whenever they change
  useEffect(() => {
    if (llmLogs.length > 0) {
      try {
        localStorage.setItem(STORAGE_LLM_LOGS_KEY, JSON.stringify(llmLogs));
      } catch (error) {
        console.error("Failed to save LLM logs:", error);
      }
    }
  }, [llmLogs]);

  // Save model settings to localStorage whenever they change (skip restoration echo)
  useEffect(() => {
    if (settingsRestoredFromStorage.current) {
      settingsRestoredFromStorage.current = false;
      return;
    }
    try {
      // Convert Set to array for JSON serialization
      const serializable = {
        enabledModels: Array.from(modelSettings.enabledModels),
        consensusCount: modelSettings.consensusCount,
      };
      localStorage.setItem(STORAGE_MODEL_SETTINGS_KEY, JSON.stringify(serializable));
    } catch (error) {
      console.error("Failed to save model settings:", error);
    }
  }, [modelSettings]);

  // Cleanup: abort ongoing consensus on unmount
  useEffect(() => {
    return () => {
      abortOngoingConsensus();
    };
  }, []);

  // Create logger for LLM strategy
  const llmLogger = useCallback((entry: Omit<LLMLogEntry, "id" | "timestamp">) => {
    const logEntry: LLMLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    setLlmLogs(prev => [...prev, logEntry]);
  }, []);

  // Create strategy based on selected mode
  const strategy: GameStrategy = useMemo(() => {
    if (gameMode === "engine") {
      return new EngineStrategy();
    } else if (gameMode === "llm") {
      return new LLMStrategy("openai", llmLogger, modelSettings);
    } else {
      // hybrid mode
      return new HybridStrategy("openai", llmLogger, modelSettings);
    }
  }, [gameMode, llmLogger, modelSettings]);

  const startGame = useCallback(() => {
    // Abort any ongoing consensus operations before starting new game
    abortOngoingConsensus();
    setIsProcessing(false); // Clear processing flag

    // Clear localStorage for fresh game (but keep model settings and game mode)
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_LLM_LOGS_KEY);
    // Note: intentionally NOT clearing STORAGE_MODEL_SETTINGS_KEY to preserve user preferences

    setGameState(initializeGame(true));
    setSelectedCards([]);
    setLlmLogs([]);
  }, []);

  // Auto-run AI turn or auto-skip empty action phase
  useEffect(() => {
    if (!gameState || gameState.gameOver || isProcessing) return;

    // Auto-run AI turn using selected strategy
    if (gameState.activePlayer === "ai") {
      const timer = setTimeout(async () => {
        setIsProcessing(true);
        try {
          const newState = await strategy.runAITurn(gameState, setGameState);
          setGameState(newState);
        } catch (error) {
          console.error("AI turn error:", error);
        } finally {
          setIsProcessing(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    // Auto-resolve opponent decisions during turn (e.g., AI responding to Militia attack)
    if (gameState.subPhase === "opponent_decision" && gameState.pendingDecision?.player === "ai") {
      const timer = setTimeout(async () => {
        setIsProcessing(true);
        try {
          const newState = await strategy.resolveAIPendingDecision(gameState);
          setGameState(newState);
          // No need to manually preserve activePlayer - subPhase system handles this!
        } catch (error) {
          console.error("AI pending decision error:", error);
        } finally {
          setIsProcessing(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    // Auto-skip action phase if no playable actions AND no pending decision
    if (gameState.activePlayer === "human" &&
        gameState.phase === "action" &&
        !gameState.pendingDecision &&
        !hasPlayableActions(gameState)) {
      setGameState(endActionPhase(gameState));
    }
  }, [gameState, strategy, isProcessing]);

  const handleCardClick = useCallback(
    async (card: CardName, _index: number) => {
      if (!gameState || gameState.activePlayer !== "human" || isProcessing) return;

      setIsProcessing(true);
      try {
        const newState = await strategy.handleCardPlay(gameState, card);
        setGameState(newState);
      } catch (error) {
        console.error("Card play error:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [gameState, strategy, isProcessing]
  );

  const handleBuyCard = useCallback(
    async (card: CardName) => {
      if (!gameState || isProcessing) return;

      // Allow clicks during gain decisions, not just buy phase
      if (gameState.pendingDecision?.type === "gain") {
        setIsProcessing(true);
        try {
          const newState = await strategy.handleBuyCard(gameState, card);
          setGameState(newState);
        } catch (error) {
          console.error("Buy card error:", error);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Normal buy logic
      if (gameState.phase !== "buy" || gameState.buys < 1) return;

      setIsProcessing(true);
      try {
        const newState = await strategy.handleBuyCard(gameState, card);
        setGameState(newState);
      } catch (error) {
        console.error("Buy card error:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [gameState, strategy, isProcessing]
  );

  const handlePlayAllTreasures = useCallback(async () => {
    if (!gameState || gameState.phase !== "buy" || isProcessing) return;

    setIsProcessing(true);
    try {
      const newState = await strategy.handlePlayAllTreasures(gameState);
      setGameState(newState);
    } catch (error) {
      console.error("Play all treasures error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [gameState, strategy, isProcessing]);

  const handleInPlayClick = useCallback(
    async (card: CardName, _index: number) => {
      if (!gameState || gameState.phase !== "buy" || isProcessing) return;

      setIsProcessing(true);
      try {
        const newState = await strategy.handleUnplayTreasure(gameState, card);
        setGameState(newState);
      } catch (error) {
        console.error("Unplay treasure error:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [gameState, strategy, isProcessing]
  );

  const handleEndPhase = useCallback(async () => {
    if (!gameState || isProcessing) return;

    setIsProcessing(true);
    try {
      const newState = await strategy.handleEndPhase(gameState);
      setGameState(newState);
    } catch (error) {
      console.error("End phase error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [gameState, strategy, isProcessing]);

  // Start screen
  if (!gameState) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minBlockSize: "100dvh",
          gap: "var(--space-8)",
          background: "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
        }}
      >
        <h1 style={{
          margin: 0,
          fontSize: "3rem",
          color: "var(--color-gold)",
          textShadow: "var(--shadow-glow-gold)",
          letterSpacing: "0.25rem",
        }}>
          DOMINION
        </h1>
        <p style={{
          color: "var(--color-text-secondary)",
          margin: 0,
          fontSize: "0.875rem",
          textTransform: "uppercase",
          letterSpacing: "0.125rem"
        }}>
          Base Game
        </p>

        {/* Game Mode Selector */}
        <div style={{
          display: "flex",
          gap: "var(--space-4)",
          padding: "var(--space-4)",
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border-primary)",
          borderRadius: "8px",
        }}>
          <button
            onClick={() => setGameMode("engine")}
            style={{
              padding: "var(--space-3) var(--space-6)",
              fontSize: "0.75rem",
              fontWeight: gameMode === "engine" ? 700 : 400,
              background: gameMode === "engine" ? "var(--color-victory-dark)" : "transparent",
              color: gameMode === "engine" ? "#fff" : "var(--color-text-secondary)",
              border: "1px solid",
              borderColor: gameMode === "engine" ? "var(--color-victory)" : "var(--color-border-primary)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
            }}
          >
            Engine Mode
          </button>
          <button
            onClick={() => setGameMode("hybrid")}
            style={{
              padding: "var(--space-3) var(--space-6)",
              fontSize: "0.75rem",
              fontWeight: gameMode === "hybrid" ? 700 : 400,
              background: gameMode === "hybrid" ? "var(--color-victory-dark)" : "transparent",
              color: gameMode === "hybrid" ? "#fff" : "var(--color-text-secondary)",
              border: "1px solid",
              borderColor: gameMode === "hybrid" ? "var(--color-victory)" : "var(--color-border-primary)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
            }}
          >
            Hybrid Mode
          </button>
          <button
            onClick={() => setGameMode("llm")}
            style={{
              padding: "var(--space-3) var(--space-6)",
              fontSize: "0.75rem",
              fontWeight: gameMode === "llm" ? 700 : 400,
              background: gameMode === "llm" ? "var(--color-victory-dark)" : "transparent",
              color: gameMode === "llm" ? "#fff" : "var(--color-text-secondary)",
              border: "1px solid",
              borderColor: gameMode === "llm" ? "var(--color-victory)" : "var(--color-border-primary)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.1rem",
              fontFamily: "inherit",
              borderRadius: "4px",
            }}
          >
            LLM Mode
          </button>
        </div>
        <p style={{
          color: "var(--color-text-tertiary)",
          margin: 0,
          fontSize: "0.75rem",
          maxWidth: "500px",
          textAlign: "center",
          lineHeight: 1.6,
        }}>
          {gameMode === "engine"
            ? "Hard-coded rules engine with explicit card implementations"
            : gameMode === "hybrid"
            ? "Engine for human moves, MAKER consensus for AI turns (GPT-4o + Claude)"
            : "Pure MAKER consensus for all moves (GPT-4o + Claude validate each step)"}
        </p>

        <button
          onClick={startGame}
          style={{
            padding: "var(--space-6) var(--space-10)",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
            color: "#fff",
            border: "2px solid var(--color-victory)",
            cursor: "pointer",
            textTransform: "uppercase",
            letterSpacing: "0.125rem",
            fontFamily: "inherit",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          Start Game
        </button>
      </div>
    );
  }

  return (
    <Board
      state={gameState}
      selectedCards={selectedCards}
      onCardClick={handleCardClick}
      onInPlayClick={handleInPlayClick}
      onBuyCard={handleBuyCard}
      onEndPhase={handleEndPhase}
      onPlayAllTreasures={handlePlayAllTreasures}
      hasPlayableActions={hasPlayableActions(gameState)}
      hasTreasuresInHand={hasTreasuresInHand(gameState)}
      llmLogs={llmLogs}
      gameMode={gameMode}
      onGameModeChange={setGameMode}
      onNewGame={startGame}
      isProcessing={isProcessing}
      modelSettings={modelSettings}
      onModelSettingsChange={setModelSettings}
    />
  );
}

export default App;
