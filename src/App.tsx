import { useState, useEffect } from "react";
import { GameProvider, useGame } from "./context/GameContext";
import { MultiplayerProvider } from "./context/MultiplayerContext";
import { Board } from "./components/Board/index";
import { StartScreen } from "./components/StartScreen";
import { MultiplayerScreen } from "./components/Lobby";

type AppMode = "menu" | "singleplayer" | "multiplayer";

const STORAGE_MODE_KEY = "dominion-maker-app-mode";

function App() {
  // Check for saved app mode on mount
  const [mode, setMode] = useState<AppMode>(() => {
    try {
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
      if (savedMode === "multiplayer" || savedMode === "singleplayer") {
        console.log("[App] Restoring saved mode:", savedMode);
        return savedMode;
      }
    } catch (e) {
      console.error("[App] Failed to check for saved mode:", e);
    }
    return "menu";
  });

  // Save mode to localStorage whenever it changes
  useEffect(() => {
    if (mode !== "menu") {
      localStorage.setItem(STORAGE_MODE_KEY, mode);
    } else {
      localStorage.removeItem(STORAGE_MODE_KEY);
    }
  }, [mode]);

  // Main menu / Single player start screen
  if (mode === "menu") {
    return (
      <GameProvider>
        <StartScreen
          onStartSinglePlayer={() => setMode("singleplayer")}
          onStartMultiplayer={() => setMode("multiplayer")}
        />
      </GameProvider>
    );
  }

  // Single player game
  if (mode === "singleplayer") {
    return (
      <GameProvider>
        <SinglePlayerGame onBackToHome={() => setMode("menu")} />
      </GameProvider>
    );
  }

  // Multiplayer
  if (mode === "multiplayer") {
    return (
      <MultiplayerProvider>
        <MultiplayerScreen onBack={() => setMode("menu")} />
      </MultiplayerProvider>
    );
  }

  return null;
}

function SinglePlayerGame({ onBackToHome }: { onBackToHome: () => void }) {
  const { gameState, isLoading, startGame } = useGame();

  // Wait for loading to complete
  if (isLoading) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100dvh",
        color: "var(--color-text-secondary)",
      }}>
        Loading...
      </div>
    );
  }

  // Auto-start game only if no saved game exists
  if (!gameState) {
    startGame();
    return null;
  }

  return <Board onBackToHome={onBackToHome} />;
}

export default App;
