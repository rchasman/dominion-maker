import { useState } from "react";
import { GameProvider, useGame } from "./context/GameContext";
import { MultiplayerProvider } from "./context/MultiplayerContext";
import { Board } from "./components/Board/index";
import { StartScreen } from "./components/StartScreen";
import { MultiplayerScreen } from "./components/Lobby";

type AppMode = "menu" | "singleplayer" | "multiplayer";


function App() {
  const [mode, setMode] = useState<AppMode>("menu");

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
        <SinglePlayerGame />
      </GameProvider>
    );
  }

  // Multiplayer
  if (mode === "multiplayer") {
    return (
      <MultiplayerProvider>
        <MultiplayerScreen
          onBack={() => setMode("menu")}
          onGameStart={() => {
            // TODO: Initialize multiplayer game board
            console.log("Multiplayer game started!");
          }}
        />
      </MultiplayerProvider>
    );
  }

  return null;
}

function SinglePlayerGame() {
  const { gameState, startGame } = useGame();

  // Auto-start game when entering single player mode
  if (!gameState) {
    startGame();
    return null;
  }

  return <Board />;
}

export default App;
