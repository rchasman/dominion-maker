/**
 * Multiplayer Context - Event-Driven P2P using Trystero
 *
 * Host runs DominionEngine, broadcasts events to clients.
 * Clients receive events and derive state locally.
 */
import {
  createContext,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { RoomState } from "../multiplayer/p2p-room";
import { DominionEngine } from "../engine";
import { P2PRoom } from "../multiplayer/p2p-room";
import { hasSavedSession } from "../multiplayer/storage";
import { useRoomConnection } from "../multiplayer/hooks/useRoomConnection";
import { useRoomReconnect } from "../multiplayer/hooks/useRoomReconnect";
import { useStartGame } from "../multiplayer/hooks/useStartGame";
import { useGameActions } from "../multiplayer/hooks/useGameActions";
import { useUndoActions } from "../multiplayer/hooks/useUndoActions";
import { useStorageEffects } from "../multiplayer/hooks/useStorageEffects";
import { useDerivedState } from "../multiplayer/hooks/useDerivedState";
import { useCleanupOnUnmount } from "../multiplayer/hooks/useCleanupOnUnmount";
import { useMultiplayerContextValue } from "../multiplayer/hooks/useMultiplayerContextValue";
import type { MultiplayerContextValue } from "../multiplayer/types";

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

// Re-export for hooks module
export { MultiplayerContext };

const INITIAL_ROOM_STATE: RoomState = {
  players: [],
  gameState: null,
  events: [],
  pendingUndo: null,
  isStarted: false,
};

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const roomRef = useRef<P2PRoom | null>(null);
  const engineRef = useRef<DominionEngine | null>(null);

  const [hasSavedSessionState, setHasSavedSession] = useState(hasSavedSession);
  const [roomState, setRoomState] = useState<RoomState>(INITIAL_ROOM_STATE);

  // Connection hooks
  const connection = useRoomConnection({
    roomRef,
    setRoomState,
    setHasSavedSession,
  });

  const reconnect = useRoomReconnect({
    roomRef,
    engineRef,
    connectionSetters: {
      setIsConnected: connection.setIsConnected,
      setRoomCode: connection.setRoomCode,
      setIsHost: connection.setIsHost,
      setMyPeerId: connection.setMyPeerId,
      setError: connection.setError,
    },
    setRoomState,
    setHasSavedSession,
  });

  // Derived state
  const derived = useDerivedState({
    roomState,
    myPeerId: connection.myPeerId,
    isConnected: connection.isConnected,
  });

  // Game hooks
  const startGameHook = useStartGame({
    roomRef,
    engineRef,
    isHost: connection.isHost,
    players: derived.players,
  });

  const gameActions = useGameActions({
    roomRef,
    engineRef,
    isHost: connection.isHost,
    myGamePlayerId: derived.myGamePlayerId,
    gameState: derived.gameState,
  });

  const undoActions = useUndoActions({
    roomRef,
    engineRef,
    myPeerId: connection.myPeerId,
    isHost: connection.isHost,
    pendingUndo: derived.pendingUndo,
    events: derived.events,
  });

  // Effects
  useStorageEffects({
    isPlaying: derived.isPlaying,
    events: derived.events,
    gameState: derived.gameState,
    roomCode: connection.roomCode,
    myPeerId: connection.myPeerId,
    isHost: connection.isHost,
    players: derived.players,
    setHasSavedSession,
  });

  useCleanupOnUnmount({ roomRef, engineRef });

  const value = useMultiplayerContextValue({
    connection: {
      ...connection,
      hasSavedSession: hasSavedSessionState,
      isReconnecting: reconnect.isReconnecting,
      reconnectToSavedRoom: reconnect.reconnectToSavedRoom,
    },
    derived,
    game: { ...gameActions, startGame: startGameHook.startGame },
    undo: undoActions,
  });

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}
