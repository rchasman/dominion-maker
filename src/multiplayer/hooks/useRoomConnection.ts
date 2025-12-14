import { useState, useCallback, useMemo, type MutableRefObject } from "preact/compat";
import { P2PRoom, generateRoomCode, type PlayerInfo } from "../p2p-room";
import { multiplayerLogger } from "../../lib/logger";
import { saveSession, clearSession } from "../storage";
import { clearGameStateStorage } from "../../context/storage-utils";
import type { RoomState } from "../p2p-room";

interface UseRoomConnectionParams {
  roomRef: MutableRefObject<P2PRoom | null>;
  setRoomState: (state: RoomState) => void;
  setHasSavedSession: (has: boolean) => void;
}

const OPTIMISTIC_HOST_PLACEHOLDER_ID = "host-placeholder";
const OPTIMISTIC_HOST_NAME = "Host";

function setupRoomStateSubscription(
  room: P2PRoom,
  setRoomState: (state: RoomState) => void,
): void {
  room.onStateChange(state => {
    multiplayerLogger.debug(
      `Host state update: ${state.events.length} events, ${state.players.length} players, pendingUndo: ${state.pendingUndo ? "pending" : "null"}`,
    );
    setRoomState(state);
  });
}

function setupClientSubscriptions(
  room: P2PRoom,
  setRoomState: (state: RoomState) => void,
): void {
  room.onStateChange(state => {
    multiplayerLogger.debug(
      `Client state update: ${state.events.length} events, ${state.players.length} players, pendingUndo: ${state.pendingUndo ? "pending" : "null"}`,
    );
    setRoomState(state);
  });

  room.onEvents(newEvents => {
    multiplayerLogger.debug(`Received ${newEvents.length} events`);
  });
}

function createOptimisticState(peerId: string, playerName: string): RoomState {
  return {
    players: [
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
    ],
    gameState: null,
    events: [],
    pendingUndo: null,
    isStarted: false,
  };
}

function getEmptyRoomState(): RoomState {
  return {
    players: [],
    gameState: null,
    events: [],
    pendingUndo: null,
    isStarted: false,
  };
}

interface RoomStateSetters {
  setIsConnected: (v: boolean) => void;
  setRoomCode: (v: string | null) => void;
  setMyPeerId: (v: string | null) => void;
  setIsHost: (v: boolean) => void;
  setRoomState: (v: RoomState) => void;
  setError: (v: string | null) => void;
  setHasSavedSession: (v: boolean) => void;
}

function createLeaveRoomHandler(
  roomRef: MutableRefObject<P2PRoom | null>,
  setters: RoomStateSetters,
) {
  return (wasHost: boolean) => {
    if (wasHost) {
      roomRef.current?.endGame("Host left the room");
    }

    roomRef.current?.leave();
    roomRef.current = null;

    setters.setIsConnected(false);
    setters.setRoomCode(null);
    setters.setMyPeerId(null);
    setters.setIsHost(false);
    setters.setRoomState(getEmptyRoomState());
    setters.setError(null);

    clearSession();
    setters.setHasSavedSession(false);
  };
}

function createEndGameHandler(
  roomRef: MutableRefObject<P2PRoom | null>,
  setHasSavedSession: (v: boolean) => void,
) {
  return () => {
    const room = roomRef.current;
    if (!room) {
      return;
    }

    room.endGame("Player ended game");
    clearSession();
    clearGameStateStorage();
    setHasSavedSession(false);
  };
}

interface CreateRoomContext {
  roomRef: MutableRefObject<P2PRoom | null>;
  setRoomState: (state: RoomState) => void;
  setHasSavedSession: (has: boolean) => void;
  setMyPeerId: (id: string) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  setIsConnected: (connected: boolean) => void;
  setIsConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
}

function executeCreateRoom(
  playerName: string,
  context: CreateRoomContext,
): string {
  const {
    roomRef,
    setRoomState,
    setHasSavedSession,
    setMyPeerId,
    setRoomCode,
    setIsHost,
    setIsConnected,
    setIsConnecting,
    setError,
  } = context;

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

    setupRoomStateSubscription(room, setRoomState);

    const initialState = room.getState();
    multiplayerLogger.debug(
      `Initial host state: ${initialState.players.length} players`,
    );
    setRoomState(initialState);

    room.setMyName(playerName);

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
}

function executeJoinRoom(
  code: string,
  playerName: string,
  context: CreateRoomContext,
): void {
  const {
    roomRef,
    setRoomState,
    setHasSavedSession,
    setMyPeerId,
    setRoomCode,
    setIsHost,
    setIsConnected,
    setIsConnecting,
    setError,
  } = context;

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

    setRoomState(createOptimisticState(peerId, playerName));
    setupClientSubscriptions(room, setRoomState);

    multiplayerLogger.debug(`Client announcing join to host`);
    room.setMyName(playerName);

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

  const { stateSetters, roomContext } = useMemo(
    () => ({
      stateSetters: {
        setIsConnected,
        setRoomCode,
        setMyPeerId,
        setIsHost,
        setRoomState,
        setError,
        setHasSavedSession,
      },
      roomContext: {
        roomRef,
        setRoomState,
        setHasSavedSession,
        setMyPeerId,
        setRoomCode,
        setIsHost,
        setIsConnected,
        setIsConnecting,
        setError,
      },
    }),
    [roomRef, setRoomState, setHasSavedSession],
  );

  const createRoom = useCallback(
    (playerName: string): string => executeCreateRoom(playerName, roomContext),
    [roomContext],
  );

  const joinRoom = useCallback(
    (code: string, playerName: string): void =>
      executeJoinRoom(code, playerName, roomContext),
    [roomContext],
  );

  const leaveRoom = useCallback(
    (wasHost: boolean) =>
      createLeaveRoomHandler(roomRef, stateSetters)(wasHost),
    [roomRef, stateSetters],
  );

  const endGame = useCallback(
    () => createEndGameHandler(roomRef, setHasSavedSession)(),
    [roomRef, setHasSavedSession],
  );

  const setMyName = useCallback(
    (name: string) => {
      roomRef.current?.setMyName(name);
    },
    [roomRef],
  );

  return {
    isConnected,
    isConnecting,
    roomCode,
    error,
    isHost,
    myPeerId,
    setIsConnected,
    setRoomCode,
    setIsHost,
    setMyPeerId,
    setError,
    setIsConnecting,
    createRoom,
    joinRoom,
    leaveRoom,
    endGame,
    setMyName,
  };
}
