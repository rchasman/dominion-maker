/**
 * SinglePlayerApp - Lazy-loaded wrapper for single player mode
 *
 * Single-player games use PartyKit rooms when available for spectating.
 * Falls back to local-only mode if PartyKit is unavailable.
 */

import { lazy, Suspense, useState, useEffect } from "preact/compat";
import { BoardSkeleton } from "./components/Board/BoardSkeleton";
import { generatePlayerName } from "./lib/name-generator";
import type { GameMode } from "./types/game-mode";
import { STORAGE_KEYS } from "./context/storage-utils";

const GameRoom = lazy(() =>
  import("./components/GameLobby/GameRoom").then(m => ({
    default: m.GameRoom,
  })),
);

const Board = lazy(() =>
  import("./components/Board/index").then(m => ({ default: m.Board })),
);

const GameProvider = lazy(() =>
  import("./context/GameContext").then(m => ({ default: m.GameProvider })),
);

interface SinglePlayerAppProps {
  onBackToHome: () => void;
}

const STORAGE_KEY = "dominion_singleplayer_room";
const PLAYER_NAME_KEY = "dominion_player_name";
const CLIENT_ID_KEY = "dominion_client_id";

function generateRoomId(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length)),
  ).join("");
}

function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function SinglePlayerApp({ onBackToHome }: SinglePlayerAppProps) {
  const [useMultiplayer, setUseMultiplayer] = useState(true);
  const [lobbyAvailable, setLobbyAvailable] = useState<boolean | null>(null);

  // Check if lobby is available
  useEffect(() => {
    const checkLobby = async () => {
      try {
        const host =
          window.location.hostname === "localhost"
            ? "localhost:1999"
            : "dominion-maker.rchasman.partykit.dev";
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const ws = new WebSocket(`${protocol}//${host}/parties/lobby/main`);

        const timeout = setTimeout(() => {
          ws.close();
          setLobbyAvailable(false);
          setUseMultiplayer(false);
        }, 3000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          setLobbyAvailable(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          setLobbyAvailable(false);
          setUseMultiplayer(false);
        };
      } catch {
        setLobbyAvailable(false);
        setUseMultiplayer(false);
      }
    };

    checkLobby();
  }, []);

  // Get game mode from localStorage
  const [gameMode, setGameModeInternal] = useState<GameMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MODE);
      if (saved) {
        const parsed = JSON.parse(saved) as string;
        if (["engine", "hybrid", "full"].includes(parsed)) {
          return parsed as GameMode;
        }
      }
    } catch {}
    return "engine";
  });

  const setGameMode = (mode: GameMode) => {
    setGameModeInternal(mode);
    try {
      localStorage.setItem(STORAGE_KEYS.MODE, JSON.stringify(mode));
    } catch {}
  };

  // Get or generate persistent IDs
  const [roomId] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    } catch {}
    const newRoomId = generateRoomId();
    try {
      localStorage.setItem(STORAGE_KEY, newRoomId);
    } catch {}
    return newRoomId;
  });

  const [playerName] = useState(() => {
    try {
      const stored = localStorage.getItem(PLAYER_NAME_KEY);
      if (stored) return stored;
    } catch {}
    const name = generatePlayerName();
    try {
      localStorage.setItem(PLAYER_NAME_KEY, name);
    } catch {}
    return name;
  });

  const [clientId] = useState(() => {
    try {
      const stored = localStorage.getItem(CLIENT_ID_KEY);
      if (stored) return stored;
    } catch {}
    const id = generateClientId();
    try {
      localStorage.setItem(CLIENT_ID_KEY, id);
    } catch {}
    return id;
  });

  const handleBack = () => {
    // Clear room ID so next single-player game gets a fresh room
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    onBackToHome();
  };

  // Show loading while checking lobby availability
  if (lobbyAvailable === null) {
    return <BoardSkeleton />;
  }

  // Use multiplayer mode if lobby is available
  if (useMultiplayer && lobbyAvailable) {
    return (
      <Suspense fallback={<BoardSkeleton />}>
        <GameRoom
          roomId={roomId}
          playerName={playerName}
          clientId={clientId}
          isSpectator={false}
          isSinglePlayer={true}
          gameMode={gameMode}
          onGameModeChange={setGameMode}
          onBack={handleBack}
        />
      </Suspense>
    );
  }

  // Fallback to local-only mode
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <GameProvider>
        <LocalSinglePlayerGame onBackToHome={handleBack} />
      </GameProvider>
    </Suspense>
  );
}

interface LocalSinglePlayerGameProps {
  onBackToHome: () => void;
}

function LocalSinglePlayerGame({ onBackToHome }: LocalSinglePlayerGameProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <BoardSkeleton />;
  }

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <Board onBackToHome={onBackToHome} />
    </Suspense>
  );
}
