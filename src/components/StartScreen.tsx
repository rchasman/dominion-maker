import "./StartScreen.css";
import type { GameMode } from "../types/game-mode";
import { GAME_MODE_CONFIG } from "../types/game-mode";

interface StartScreenProps {
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  onStartSinglePlayer?: () => void;
  onStartMultiplayer?: () => void;
}

const prefetchSinglePlayer = () => void import("../SinglePlayerApp");
const prefetchMultiplayer = () => void import("./GameLobby");

export function StartScreen({
  gameMode,
  onGameModeChange,
  onStartSinglePlayer,
  onStartMultiplayer,
}: StartScreenProps) {
  return (
    <main className="start-screen">
      <header className="start-screen-heading">
        <h1>DOMINION</h1>
        <p>Base Game</p>
      </header>
      <div className="start-mode-switcher" role="group" aria-label="Game mode">
        {(["engine", "hybrid", "full"] as const).map(mode => (
          <button
            key={mode}
            type="button"
            aria-pressed={gameMode === mode}
            aria-describedby="game-mode-description"
            onClick={() => onGameModeChange(mode)}
          >
            {GAME_MODE_CONFIG[mode].name}
          </button>
        ))}
      </div>
      <p id="game-mode-description" className="start-mode-description">
        {gameMode !== "multiplayer" && GAME_MODE_CONFIG[gameMode].description}
      </p>
      <div className="start-actions">
        <button
          type="button"
          className="start-action start-action-single"
          onClick={onStartSinglePlayer}
          onMouseEnter={prefetchSinglePlayer}
          onFocus={prefetchSinglePlayer}
        >
          Single Player
        </button>
        {onStartMultiplayer && (
          <button
            type="button"
            className="start-action start-action-multi"
            onClick={onStartMultiplayer}
            onMouseEnter={prefetchMultiplayer}
            onFocus={prefetchMultiplayer}
          >
            Multiplayer
          </button>
        )}
      </div>
    </main>
  );
}
