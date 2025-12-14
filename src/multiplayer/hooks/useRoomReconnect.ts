import { useState, useCallback, type MutableRefObject } from "preact/compat";
import { P2PRoom } from "../p2p-room";
import type { RoomState, PlayerInfo } from "../p2p-room";
import type { DominionEngine } from "../../engine";
import { multiplayerLogger } from "../../lib/logger";
import { loadSession, clearSession } from "../storage";
import { projectState } from "../../events/project";
import { syncEventCounter } from "../../events/id-generator";
import { createCommandHandler } from "../command-handler";

const MIN_PLAYERS_FOR_STATE = 0;
const MIN_EVENTS_FOR_STATE = 0;

interface ConnectionSetters {
  setIsConnected: (connected: boolean) => void;
  setRoomCode: (code: string) => void;
  setIsHost: (isHost: boolean) => void;
  setMyPeerId: (peerId: string) => void;
  setError: (error: string | null) => void;
}

interface ReconnectContext {
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
  connectionSetters: ConnectionSetters;
  setRoomState: (state: RoomState) => void;
  setHasSavedSession: (has: boolean) => void;
  setIsReconnecting: (reconnecting: boolean) => void;
}

function setupRoomSubscription(
  room: P2PRoom,
  setRoomState: (state: RoomState) => void,
): void {
  room.onStateChange(state => {
    multiplayerLogger.debug(
      `Room state update: ${state.events.length} events, ${state.players.length} players`,
    );
    const hasData =
      state.players.length > MIN_PLAYERS_FOR_STATE ||
      state.events.length > MIN_EVENTS_FOR_STATE;
    if (hasData) {
      setRoomState(state);
    }
  });
}

function executeReconnect(context: ReconnectContext): void {
  const {
    roomRef,
    engineRef,
    connectionSetters,
    setRoomState,
    setHasSavedSession,
    setIsReconnecting,
  } = context;
  const { setIsConnected, setRoomCode, setIsHost, setMyPeerId, setError } =
    connectionSetters;

  setError(null);
  setIsReconnecting(true);

  try {
    const session = loadSession();
    if (!session) {
      throw new Error("No saved session found");
    }

    const { events, roomInfo } = session;

    multiplayerLogger.debug(
      `Reconnecting to room: ${roomInfo.roomCode} as ${roomInfo.isHost ? "host" : "client"}`,
      { myPeerId: roomInfo.myPeerId },
    );

    const room = new P2PRoom(
      roomInfo.roomCode,
      roomInfo.isHost,
      roomInfo.myPeerId,
    );
    roomRef.current = room;

    const peerId = room.getMyPeerId();
    if (!peerId) {
      throw new Error("Failed to get peer ID");
    }
    if (peerId !== roomInfo.myPeerId) {
      multiplayerLogger.warn(
        "peerId mismatch! Saved:",
        roomInfo.myPeerId,
        "Got:",
        peerId,
      );
    }

    setMyPeerId(roomInfo.myPeerId);
    setRoomCode(roomInfo.roomCode);
    setIsHost(roomInfo.isHost);
    setIsConnected(true);

    const restoredGameState = projectState(events);
    multiplayerLogger.debug("Restored game state", {
      turn: restoredGameState.turn,
      activePlayer: restoredGameState.activePlayer,
      phase: restoredGameState.phase,
      pendingDecision: !!restoredGameState.pendingDecision,
    });

    const initialRoomState: RoomState = {
      players: roomInfo.players,
      gameState: restoredGameState,
      events,
      pendingUndo: null,
      isStarted: true,
    };
    setRoomState(initialRoomState);

    setupRoomSubscription(room, setRoomState);

    if (roomInfo.isHost) {
      reconnectAsHost(room, engineRef, events, roomInfo.players);
    } else {
      reconnectAsClient(room, engineRef, events, roomInfo.players);
    }

    const myName =
      roomInfo.players.find(p => p.id === roomInfo.myPeerId)?.name ?? "Player";
    room.setMyName(myName);

    setIsReconnecting(false);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to reconnect";
    setError(message);
    setIsReconnecting(false);
    clearSession();
    setHasSavedSession(false);
    throw error;
  }
}

interface UseRoomReconnectParams {
  roomRef: MutableRefObject<P2PRoom | null>;
  engineRef: MutableRefObject<DominionEngine | null>;
  connectionSetters: ConnectionSetters;
  setRoomState: (state: RoomState) => void;
  setHasSavedSession: (has: boolean) => void;
}

export function useRoomReconnect({
  roomRef,
  engineRef,
  connectionSetters,
  setRoomState,
  setHasSavedSession,
}: UseRoomReconnectParams) {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const reconnectToSavedRoom = useCallback(
    (): void =>
      executeReconnect({
        roomRef,
        engineRef,
        connectionSetters,
        setRoomState,
        setHasSavedSession,
        setIsReconnecting,
      }),
    [roomRef, engineRef, connectionSetters, setRoomState, setHasSavedSession],
  );

  return {
    isReconnecting,
    reconnectToSavedRoom,
  };
}

function reconnectAsHost(
  room: P2PRoom,
  engineRef: MutableRefObject<DominionEngine | null>,
  events: ReadonlyArray<unknown>,
  players: PlayerInfo[],
): void {
  syncEventCounter(events);
  const engine = new DominionEngine();
  engineRef.current = engine;

  // Load saved events
  engine.loadEvents(events);
  const engineState = engine.state;

  multiplayerLogger.debug(`Host restored engine with ${events.length} events`);

  // Restore players BEFORE starting game (critical!)
  room.restorePlayers(players);

  // Update room with restored state and events
  room.startGameWithEvents(engineState, events);

  // Subscribe to future events
  engine.subscribe((newEvents, state) => {
    multiplayerLogger.debug(`Engine emitted ${newEvents.length} events`);
    room.broadcastEvents(newEvents, state);
  });

  // Handle commands from clients
  const commandHandler = createCommandHandler(engine, room, players);
  room.onCommand(commandHandler);
}

function reconnectAsClient(
  room: P2PRoom,
  engineRef: MutableRefObject<DominionEngine | null>,
  events: ReadonlyArray<unknown>,
  players: PlayerInfo[],
): void {
  syncEventCounter(events);
  const engine = new DominionEngine();
  engineRef.current = engine;
  engine.loadEvents(events);

  multiplayerLogger.debug(
    `Client restored engine with ${events.length} events`,
  );

  // Restore players in room (so getState() works correctly)
  room.restorePlayers(players);

  // Subscribe to events from host
  room.onEvents(newEvents => {
    multiplayerLogger.debug(
      `Client received ${newEvents.length} events, applying locally`,
    );
    // Apply to local engine
    engine.applyExternalEvents(newEvents);
  });
}
