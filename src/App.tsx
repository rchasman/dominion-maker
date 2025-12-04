import { GameProvider, useGame } from "./context/GameContext";
import { Board } from "./components/Board/index";
import { StartScreen } from "./components/StartScreen";

function GameRoot() {
  const { gameState } = useGame();
  return gameState ? <Board /> : <StartScreen />;
}

function App() {
  return (
    <GameProvider>
      <GameRoot />
    </GameProvider>
  );
}

export default App;
