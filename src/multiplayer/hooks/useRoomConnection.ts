import { useState, useCallback, type MutableRefObject } from "react";
import { P2PRoom, generateRoomCode, type PlayerInfo } from "../p2p-room";
import { multiplayerLogger } from "../../lib/logger";
import { saveSession, clearSession } from "../storage";
import type { RoomState } from "../p2p-room";

interface UseRoomConnectionParams {
  roomRef: MutableRefObject<P2PRoom | null>;
  setRoomState: (state: RoomState) => void;
  setHasSavedSession: (has: boolean) => void;
}

export function useRoomConnection({
  roomRef,
  setRoomState,
  setHasSavedSession,
}: UseRoomConnectionParams) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);

  const OPTIMISTIC_HOST_PLACEHOLDER_ID = "host-placeholder";
  const OPTIMISTIC_HOST_NAME = "Host";

  const createRoom = useCallback(
    async (playerName: string): Promise<string> => {
      setError(null);
      setIsConnecting(true);
      clearSession();

      try {
        const code = generateRoomCode();
        const room = new P2PRoom(code, true);
        roomRef.current = room;

        const peerId = room.getMyPeerId();
        if (!peerId) {
          throw new Error("Failed to get peer ID");
        }

        setMyPeerId(peerId);
        setRoomCode(code);
        setIsHost(true);
        setIsConnected(true);
        setIsConnecting(false);

        // Subscribe to state changes
        room.onStateChange(state => {
          multiplayerLogger.debug(
            `Host state update: ${state.events.length} events, ${state.players.length} players, pendingUndo: ${state.pendingUndo ? "pending" : "null"}`,
          );
          setRoomState(state);
        });

        // Get initial state immediately to populate UI
        const initialState = room.getState();
        multiplayerLogger.debug(
          `Initial host state: ${initialState.players.length} players`,
        );
        setRoomState(initialState);

        // Set my name
        room.setMyName(playerName);

        // Save to localStorage for reconnect
        const playerInfo: PlayerInfo = {
          id: peerId,
          name: playerName,
          isAI: false,
          connected: true,
        };

        saveSession([], {
          roomCode: code,
          myPeerId: peerId,
          isHost: true,
          players: [playerInfo],
        });
        setHasSavedSession(true);

        return code;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to create room";
        setError(message);
        setIsConnecting(false);
        throw error;
      }
    },
    [roomRef, setRoomState, setHasSavedSession],
  );

  const joinRoom = useCallback(
    async (code: string, playerName: string): Promise<void> => {
      setError(null);
      setIsConnecting(true);
      clearSession();

      try {
        const room = new P2PRoom(code.toUpperCase(), false);
        roomRef.current = room;

        const peerId = room.getMyPeerId();
        if (!peerId) {
          throw new Error("Failed to get peer ID");
        }

        setMyPeerId(peerId);
        setRoomCode(code.toUpperCase());
        setIsHost(false);
        setIsConnected(true);
        setIsConnecting(false);

        // Set optimistic state immediately (will be replaced by real state)
        const optimisticPlayers: PlayerInfo[] = [
          {
            id: OPTIMISTIC_HOST_PLACEHOLDER_ID,
            name: OPTIMISTIC_HOST_NAME,
            isAI: false,
            connected: true,
          },
          {
            id: peerId,
            name: playerName,
            isAI: false,
            connected: true,
          },
        ];

        setRoomState({
          players: optimisticPlayers,
          gameState: null,
          events: [],
          pendingUndo: null,
          isStarted: false,
        });

        // Subscribe to state changes
        room.onStateChange(state => {
          multiplayerLogger.debug(
            `Client state update: ${state.events.length} events, ${state.players.length} players, pendingUndo: ${state.pendingUndo ? "pending" : "null"}`,
          );
          setRoomState(state);
        });

        // Subscribe to events
        room.onEvents(newEvents => {
          multiplayerLogger.debug(`Received ${newEvents.length} events`);
          // State will be updated via onStateChange
        });

        // Announce join (will queue until connection established)
        multiplayerLogger.debug(`Client announcing join to host`);
        room.setMyName(playerName);

        // Save to localStorage for reconnect
        const playerInfo: PlayerInfo = {
          id: peerId,
          name: playerName,
          isAI: false,
          connected: true,
        };

        saveSession([], {
          roomCode: code.toUpperCase(),
          myPeerId: peerId,
          isHost: false,
          players: [playerInfo],
        });
        setHasSavedSession(true);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to join room";
        setError(message);
        setIsConnecting(false);
        throw error;
      }
    },
    [roomRef, setRoomState, setHasSavedSession],
  );

  const leaveRoom = useCallback(
    (wasHost: boolean) => {
      if (wasHost) {
        // Host leaving - end the game for everyone
        roomRef.current?.endGame("Host left the room");
      }

      roomRef.current?.leave();
      roomRef.current = null;

      setIsConnected(false);
      setRoomCode(null);
      setMyPeerId(null);
      setIsHost(false);
      setRoomState({
        players: [],
        gameState: null,
        events: [],
        pendingUndo: null,
        isStarted: false,
      });
      setError(null);

      clearSession();
      setHasSavedSession(false);
    },
    [roomRef, setRoomState, setHasSavedSession],
  );

  const endGame = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      return;
    }

    // Broadcast game end - this will set gameOver flag
    room.endGame("Player ended game");

    clearSession();
    setHasSavedSession(false);

    // Don't leave immediately - let the game over modal show
  }, [roomRef, setHasSavedSession]);

  const setMyName = useCallback(
    (name: string) => {
      roomRef.current?.setMyName(name);
    },
    [roomRef],
  );

  return {
    // State
    isConnected,
    isConnecting,
    roomCode,
    error,
    isHost,
    myPeerId,
    // State setters (for reconnect hook)
    setIsConnected,
    setRoomCode,
    setIsHost,
    setMyPeerId,
    setError,
    setIsConnecting,
    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    endGame,
    setMyName,
  };
}
