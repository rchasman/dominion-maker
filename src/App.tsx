import { useState, useEffect } from "react";
import { GameProvider, useGame } from "./context/GameContext";
import { MultiplayerProvider, useMultiplayer } from "./context/MultiplayerContext";
import { Board } from "./components/Board/index";
import { StartScreen } from "./components/StartScreen";
import { MultiplayerScreen } from "./components/Lobby";

type AppMode = "menu" | "singleplayer" | "multiplayer";

const STORAGE_ROOM_KEY = "dominion-maker-multiplayer-room";

function App() {
  // Check for saved multiplayer session on mount
  const [mode, setMode] = useState<AppMode>(() => {
    try {
      const savedRoom = localStorage.getItem(STORAGE_ROOM_KEY);
      if (savedRoom) {
        console.log("[App] Found saved room, auto-navigating to multiplayer");
        return "multiplayer";
      }
    } catch (e) {
      console.error("[App] Failed to check for saved session:", e);
    }
    return "menu";
  });

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
  const { gameState, startGame } = useGame();

  // Auto-start game when entering single player mode
  if (!gameState) {
    startGame();
    return null;
  }

  return <Board onBackToHome={onBackToHome} />;
}

export default App;
