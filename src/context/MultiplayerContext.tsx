/**
 * Multiplayer Context - React integration for Martini Kit
 *
 * Provides hooks for creating/joining rooms and accessing multiplayer state.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { GameRuntime, type WithLobby, type LobbyState } from "@martini-kit/core";
import {
  TrysteroTransport,
  generateRoomCode,
} from "../multiplayer/trystero-transport";
import {
  dominionGame,
  type MultiplayerState,
} from "../multiplayer/game-definition";
import type { GameState, PlayerType } from "../types/game-state";
import { initializeMultiplayerGame } from "../lib/game-init";

// App ID for Trystero (unique to this app)
const TRYSTERO_APP_ID = "dominion-maker-multiplayer-v1";

type FullState = WithLobby<MultiplayerState>;

interface MultiplayerContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  roomCode: string | null;
  error: string | null;

  // Player info
  myPlayerId: string | null;
  isHost: boolean;

  // Lobby state
  lobbyState: LobbyState | null;
  multiplayerState: MultiplayerState | null;

  // Game state (convenience accessor)
  gameState: GameState | null;

  // Computed helpers
  isInLobby: boolean;
  isPlaying: boolean;
  isMyTurn: boolean;
  myPlayerIndex: number | null;

  // Actions
  createRoom: (playerName: string) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string) => Promise<void>;
  leaveRoom: () => void;

  // Lobby actions
  setReady: (ready: boolean) => void;
  startGame: () => void;
  setGameMode: (mode: "engine" | "llm" | "hybrid") => void;
  toggleSlotType: (slotIndex: number) => void;
  setPlayerName: (name: string) => void;

  // Game actions
  updateGameState: (newState: GameState) => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function useMultiplayer(): MultiplayerContextValue {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error("useMultiplayer must be used within MultiplayerProvider");
  }
  return context;
}

interface MultiplayerProviderProps {
  children: ReactNode;
}

export function MultiplayerProvider({ children }: MultiplayerProviderProps) {
  // Runtime and transport refs
  const runtimeRef = useRef<GameRuntime<MultiplayerState> | null>(null);
  const transportRef = useRef<TrysteroTransport | null>(null);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);

  // Multiplayer state from runtime
  const [fullState, setFullState] = useState<FullState | null>(null);

  // Derived state
  const lobbyState = fullState?.__lobby ?? null;
  const multiplayerState = fullState
    ? {
        playerSlots: fullState.playerSlots,
        settings: fullState.settings,
        gameState: fullState.gameState,
        playerIdToIndex: fullState.playerIdToIndex,
      }
    : null;
  const gameState = fullState?.gameState ?? null;

  const isInLobby = lobbyState?.phase === "lobby";
  const isPlaying = lobbyState?.phase === "playing";

  const myPlayerIndex =
    myPlayerId && multiplayerState
      ? multiplayerState.playerIdToIndex[myPlayerId] ?? null
      : null;

  // Compute isMyTurn based on game state and player index
  const isMyTurn = (() => {
    if (!gameState || myPlayerIndex === null) return false;
    const activePlayer = gameState.activePlayer;
    const myPlayer = `player${myPlayerIndex}`;
    return activePlayer === myPlayer;
  })();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runtimeRef.current?.destroy();
      transportRef.current?.leave();
    };
  }, []);

  /**
   * Create a new room as host
   */
  const createRoom = useCallback(
    async (playerName: string): Promise<string> => {
      setIsConnecting(true);
      setError(null);

      try {
        const code = generateRoomCode();
        const playerId = crypto.randomUUID();

        // Create transport as host
        const transport = new TrysteroTransport({
          appId: TRYSTERO_APP_ID,
          roomId: code,
          isHost: true,
          playerId,
        });
        transportRef.current = transport;

        // Create runtime
        const runtime = new GameRuntime(dominionGame, transport, {
          isHost: true,
          playerIds: [playerId],
        });
        runtimeRef.current = runtime;

        // Subscribe to state changes
        runtime.onChange((state) => {
          setFullState(state as FullState);
        });

        // Subscribe to connection state
        transport.metrics?.onConnectionChange((state) => {
          setIsConnected(state === "connected");
        });

        // Set player name
        runtime.submitAction("setPlayerName", { name: playerName });

        setRoomCode(code);
        setMyPlayerId(playerId);
        setIsHost(true);
        setIsConnected(true);
        setIsConnecting(false);

        return code;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to create room";
        setError(message);
        setIsConnecting(false);
        throw e;
      }
    },
    []
  );

  /**
   * Join an existing room as client
   */
  const joinRoom = useCallback(
    async (code: string, playerName: string): Promise<void> => {
      setIsConnecting(true);
      setError(null);

      try {
        const playerId = crypto.randomUUID();

        // Create transport as client
        const transport = new TrysteroTransport({
          appId: TRYSTERO_APP_ID,
          roomId: code.toUpperCase(),
          isHost: false,
          playerId,
        });
        transportRef.current = transport;

        // Create runtime
        const runtime = new GameRuntime(dominionGame, transport, {
          isHost: false,
          playerIds: [playerId],
        });
        runtimeRef.current = runtime;

        // Subscribe to state changes
        runtime.onChange((state) => {
          setFullState(state as FullState);
        });

        // Subscribe to connection state
        transport.metrics?.onConnectionChange((state) => {
          setIsConnected(state === "connected");
          if (state === "connected") {
            setIsConnecting(false);
          }
        });

        // Wait a bit for connection, then set name
        setTimeout(() => {
          runtime.submitAction("setPlayerName", { name: playerName });
        }, 500);

        setRoomCode(code.toUpperCase());
        setMyPlayerId(playerId);
        setIsHost(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to join room";
        setError(message);
        setIsConnecting(false);
        throw e;
      }
    },
    []
  );

  /**
   * Leave the current room
   */
  const leaveRoom = useCallback(() => {
    runtimeRef.current?.destroy();
    transportRef.current?.leave();
    runtimeRef.current = null;
    transportRef.current = null;

    setIsConnected(false);
    setRoomCode(null);
    setMyPlayerId(null);
    setIsHost(false);
    setFullState(null);
    setError(null);
  }, []);

  // Lobby actions
  const setReady = useCallback((ready: boolean) => {
    runtimeRef.current?.submitAction("__lobbyReady", { ready });
  }, []);

  const startGame = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !fullState) return;

    // Get player configs from the current state
    const playerConfigs = fullState.playerSlots.map((slot) => ({
      id: slot.id,
      name: slot.name,
      type: slot.type as PlayerType,
    }));

    // Initialize the Dominion game state
    const dominionGameState = initializeMultiplayerGame(playerConfigs);

    // First initialize the game state
    runtime.submitAction("initializeGame", { gameState: dominionGameState });

    // Then start the lobby (transitions to playing phase)
    runtime.submitAction("__lobbyStart", {});
  }, [fullState]);

  const setGameMode = useCallback((mode: "engine" | "llm" | "hybrid") => {
    runtimeRef.current?.submitAction("setGameMode", { mode });
  }, []);

  const toggleSlotType = useCallback((slotIndex: number) => {
    runtimeRef.current?.submitAction("toggleSlotType", { slotIndex });
  }, []);

  const setPlayerName = useCallback((name: string) => {
    runtimeRef.current?.submitAction("setPlayerName", { name });
  }, []);

  // Game actions
  const updateGameState = useCallback((newState: GameState) => {
    runtimeRef.current?.submitAction("updateGameState", { gameState: newState });
  }, []);

  const value: MultiplayerContextValue = {
    isConnected,
    isConnecting,
    roomCode,
    error,
    myPlayerId,
    isHost,
    lobbyState,
    multiplayerState,
    gameState,
    isInLobby,
    isPlaying,
    isMyTurn,
    myPlayerIndex,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    startGame,
    setGameMode,
    toggleSlotType,
    setPlayerName,
    updateGameState,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}
