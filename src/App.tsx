import { useState, useEffect } from "preact/hooks";
import { lazy, Suspense } from "preact/compat";
import type { GameMode } from "./types/game-mode";
import { StartScreen } from "./components/StartScreen";
import { STORAGE_KEYS } from "./context/storage-utils";
import { uiLogger } from "./lib/logger";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Lazy load game modules (keeps partykit out of single-player bundle)
const singlePlayerImport = () =>
  import("./SinglePlayerApp").then(m => ({ default: m.SinglePlayerApp }));
const gameLobbyImport = () =>
  import("./components/GameLobby").then(m => ({ default: m.GameLobby }));

const SinglePlayerApp = lazy(singlePlayerImport);
const GameLobby = lazy(gameLobbyImport);

// Preload game modules after menu renders (best of both worlds)
const preloadSinglePlayer = () => void singlePlayerImport();
const preloadMultiplayer = () => void gameLobbyImport();

type AppMode = "menu" | "singleplayer" | "multiplayer";

const STORAGE_APP_MODE_KEY = "dominion-maker-app-mode";

function App() {
  // App navigation mode (menu vs singleplayer vs multiplayer)
  const [mode, setMode] = useState<AppMode>(() => {
    try {
      const savedMode = localStorage.getItem(STORAGE_APP_MODE_KEY);
      if (savedMode === "multiplayer" || savedMode === "singleplayer") {
        uiLogger.debug("Restoring saved mode", { savedMode });
        return savedMode;
      }
    } catch (e) {
      uiLogger.error("Failed to check for saved mode", { error: e });
    }
    return "menu";
  });

  // Game mode selection (engine/hybrid/full) - synced to localStorage
  const [gameMode, setGameMode] = useState<GameMode>(() => {
    try {
      const savedMode = localStorage.getItem(STORAGE_KEYS.MODE);
      if (savedMode) {
        const parsed = JSON.parse(savedMode) as string;
        if (["engine", "hybrid", "full"].includes(parsed)) {
          return parsed as GameMode;
        }
      }
    } catch {
      // Invalid JSON, use default
    }
    return "engine";
  });

  // Sync app mode to localStorage
  useEffect(() => {
    if (mode !== "menu") {
      localStorage.setItem(STORAGE_APP_MODE_KEY, mode);
    } else {
      localStorage.removeItem(STORAGE_APP_MODE_KEY);
    }
  }, [mode]);

  // Sync game mode to localStorage (GameProvider will read this on mount)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify(gameMode));
    } catch {
      // Storage unavailable
    }
  }, [gameMode]);

  // Preload game modules when on menu (loads in background while user reads)
  useEffect(() => {
    if (mode === "menu") {
      preloadSinglePlayer();
      preloadMultiplayer();
    }
  }, [mode]);

  // Main menu - no GameProvider needed!
  if (mode === "menu") {
    return (
      <StartScreen
        gameMode={gameMode}
        onGameModeChange={setGameMode}
        onStartSinglePlayer={() => setMode("singleplayer")}
        onStartMultiplayer={() => setMode("multiplayer")}
      />
    );
  }

  // Single player game - GameProvider loaded lazily with SinglePlayerApp
  if (mode === "singleplayer") {
    return (
      <ErrorBoundary
        fallback={(_error, _retry) => (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minBlockSize: "100dvh",
              gap: "var(--space-6)",
              background:
                "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
            }}
          >
            <h2 style={{ color: "var(--color-attack)" }}>
              Failed to load game
            </h2>
            <button
              onClick={() => setMode("menu")}
              style={{
                padding: "var(--space-5) var(--space-7)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background:
                  "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
                color: "#fff",
                border: "2px solid var(--color-victory)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
              }}
            >
              Back to Menu
            </button>
          </div>
        )}
      >
        <Suspense fallback={<LoadingScreen />}>
          <SinglePlayerApp onBackToHome={() => setMode("menu")} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Multiplayer - GameLobby loaded lazily
  if (mode === "multiplayer") {
    return (
      <ErrorBoundary
        fallback={(_error, _retry) => (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minBlockSize: "100dvh",
              gap: "var(--space-6)",
              background:
                "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
            }}
          >
            <h2 style={{ color: "var(--color-attack)" }}>
              Failed to load multiplayer
            </h2>
            <button
              onClick={() => setMode("menu")}
              style={{
                padding: "var(--space-5) var(--space-7)",
                fontSize: "0.875rem",
                fontWeight: 600,
                background:
                  "linear-gradient(180deg, var(--color-victory-darker) 0%, var(--color-victory-dark) 100%)",
                color: "#fff",
                border: "2px solid var(--color-victory)",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.125rem",
                fontFamily: "inherit",
              }}
            >
              Back to Menu
            </button>
          </div>
        )}
      >
        <Suspense fallback={<LoadingScreen />}>
          <GameLobby onBack={() => setMode("menu")} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return null;
}

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minBlockSize: "100dvh",
        background:
          "linear-gradient(180deg, var(--color-bg-primary) 0%, var(--color-bg-secondary) 100%)",
      }}
    />
  );
}

export default App;
