import { useState, useCallback } from "react";
import type { GameState, CardName } from "./types/game-state";
import { initializeGame } from "./lib/game-init";
import { advanceGameState, runAITurn, type ModelProvider } from "./agent/game-agent";
import { Board } from "./components/Board";
import { ActionPrompt } from "./components/ActionPrompt";
import { isActionCard, isTreasureCard } from "./data/cards";

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCards, setSelectedCards] = useState<CardName[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ModelProvider>("openai");

  const startGame = useCallback(() => {
    setGameState(initializeGame(true));
    setSelectedCards([]);
  }, []);

  const handleAdvance = useCallback(
    async (choice?: { selectedCards: CardName[] }) => {
      if (!gameState || loading) return;

      setLoading(true);
      try {
        let newState = await advanceGameState(gameState, choice, provider);

        // If it's now AI's turn, run the full AI turn
        if (newState.activePlayer === "ai" && !newState.gameOver) {
          newState = await runAITurn(newState, provider);
        }

        setGameState(newState);
        setSelectedCards([]);
      } catch (err) {
        console.error("Error advancing game state:", err);
      } finally {
        setLoading(false);
      }
    },
    [gameState, loading, provider]
  );

  const handleCardClick = useCallback(
    (card: CardName, _index: number) => {
      if (!gameState || gameState.activePlayer !== "human") return;

      const { phase, pendingDecision } = gameState;

      // If there's a pending decision, toggle selection
      if (pendingDecision) {
        setSelectedCards((prev) =>
          prev.includes(card)
            ? prev.filter((c) => c !== card)
            : [...prev, card]
        );
        return;
      }

      // Action phase: play action cards
      if (phase === "action" && isActionCard(card) && gameState.actions > 0) {
        handleAdvance({ selectedCards: [card] });
        return;
      }

      // Buy phase: play treasures
      if (phase === "buy" && isTreasureCard(card)) {
        handleAdvance({ selectedCards: [card] });
        return;
      }
    },
    [gameState, handleAdvance]
  );

  const handleBuyCard = useCallback(
    (card: CardName) => {
      if (!gameState || gameState.phase !== "buy" || gameState.buys < 1) return;
      handleAdvance({ selectedCards: [card] });
    },
    [gameState, handleAdvance]
  );

  const handleEndPhase = useCallback(() => {
    handleAdvance({ selectedCards: [] });
  }, [handleAdvance]);

  const handleConfirmDecision = useCallback(() => {
    handleAdvance({ selectedCards });
  }, [handleAdvance, selectedCards]);

  const handleSkipDecision = useCallback(() => {
    handleAdvance({ selectedCards: [] });
  }, [handleAdvance]);

  // Start screen
  if (!gameState) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: "24px",
        }}
      >
        <h1>Dominion</h1>
        <p style={{ color: "#666" }}>Base Game - AI Facilitator</p>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <label>Model:</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ModelProvider)}
            style={{ padding: "8px", fontSize: "16px" }}
          >
            <option value="openai">OpenAI (GPT-4o)</option>
            <option value="anthropic">Anthropic (Claude)</option>
          </select>
        </div>

        <button
          onClick={startGame}
          style={{
            padding: "16px 32px",
            fontSize: "18px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Start Game
        </button>

        <p style={{ fontSize: "12px", color: "#999", maxWidth: "400px", textAlign: "center" }}>
          Set VITE_OPENAI_API_KEY or VITE_ANTHROPIC_API_KEY in .env
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: gameState.pendingDecision ? "300px" : "20px" }}>
      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            background: "#4CAF50",
            color: "white",
            padding: "8px",
            textAlign: "center",
            zIndex: 1000,
          }}
        >
          Thinking...
        </div>
      )}

      <Board
        state={gameState}
        selectedCards={selectedCards}
        onCardClick={handleCardClick}
        onBuyCard={handleBuyCard}
        onEndPhase={handleEndPhase}
      />

      {gameState.pendingDecision && gameState.pendingDecision.player === "human" && (
        <ActionPrompt
          decision={gameState.pendingDecision}
          selectedCards={selectedCards}
          onToggleCard={(card) =>
            setSelectedCards((prev) =>
              prev.includes(card)
                ? prev.filter((c) => c !== card)
                : [...prev, card]
            )
          }
          onConfirm={handleConfirmDecision}
          onSkip={gameState.pendingDecision.canSkip ? handleSkipDecision : undefined}
        />
      )}
    </div>
  );
}

export default App;
