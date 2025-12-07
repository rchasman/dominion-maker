/**
 * Multiplayer Context - Event-Driven P2P using Trystero
 *
 * Host runs DominionEngine, broadcasts events to clients.
 * Clients receive events and derive state locally.
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
import { P2PRoom, generateRoomCode, type PlayerInfo, type RoomState, type PendingUndoRequest } from "../multiplayer/p2p-room";
import type { GameState, CardName, Player } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import { DominionEngine } from "../engine";
import { projectState } from "../events/project";
import { resetEventCounter, syncEventCounter } from "../events/id-generator";

const STORAGE_KEY = "dominion-maker-multiplayer-events";
const STORAGE_ROOM_KEY = "dominion-maker-multiplayer-room";

interface MultiplayerContextValue {
  // Connection
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  roomCode: string | null;
  error: string | null;
  hasSavedSession: boolean;

  // Player info
  myPeerId: string | null;
  myPlayerIndex: number | null;
  myGamePlayerId: Player | null;
  isHost: boolean;

  // Room state
  players: PlayerInfo[];
  gameState: GameState | null;
  events: GameEvent[];
  pendingUndo: PendingUndoRequest | null;
  isInLobby: boolean;
  isPlaying: boolean;
  isMyTurn: boolean;

  // Lobby actions
  createRoom: (playerName: string) => Promise<string>;
  joinRoom: (code: string, playerName: string) => Promise<void>;
  reconnectToSavedRoom: () => Promise<void>;
  leaveRoom: () => void;
  endGame: () => void;
  setMyName: (name: string) => void;
  startGame: () => void;

  // Game actions (event-driven)
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;

  // Undo / Time travel
  requestUndo: (toEventId: string, reason?: string) => void;
  approveUndo: () => void;
  denyUndo: () => void;
  getStateAtEvent: (eventId: string) => GameState;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

export function useMultiplayer(): MultiplayerContextValue {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error("useMultiplayer must be used within MultiplayerProvider");
  }
  return context;
}

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const roomRef = useRef<P2PRoom | null>(null);
  const engineRef = useRef<DominionEngine | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);

  // Check if there's a saved session
  const [hasSavedSession, setHasSavedSession] = useState(() => {
    try {
      const savedRoom = localStorage.getItem(STORAGE_ROOM_KEY);
      const savedEvents = localStorage.getItem(STORAGE_KEY);
      return !!(savedRoom && savedEvents);
    } catch {
      return false;
    }
  });

  // Room state
  const [roomState, setRoomState] = useState<RoomState>({
    players: [],
    gameState: null,
    events: [],
    pendingUndo: null,
    isStarted: false,
  });

  const players = roomState.players;
  const gameState = roomState.gameState;
  const events = roomState.events;
  const pendingUndo = roomState.pendingUndo;
  const isInLobby = isConnected && !roomState.isStarted;
  const isPlaying = roomState.isStarted && gameState !== null;

  // Find my player index
  const myPlayerIndex = myPeerId
    ? players.findIndex((p) => p.id === myPeerId)
    : null;

  const myGamePlayerId: Player | null =
    myPlayerIndex !== null && myPlayerIndex >= 0
      ? (`player${myPlayerIndex}` as Player)
      : null;

  // Debug logging for player mapping
  useEffect(() => {
    if (isPlaying && myPeerId) {
      console.log("[MultiplayerContext] Player mapping:", {
        myPeerId,
        myPlayerIndex,
        myGamePlayerId,
        playersInRoom: players.map(p => p.id),
        foundInList: players.some(p => p.id === myPeerId),
      });
    }
  }, [isPlaying, myPeerId, myPlayerIndex, myGamePlayerId, players]);

  const isMyTurn = (() => {
    if (!isPlaying || !gameState || !myGamePlayerId) {
      return false;
    }
    // If there's a pending decision, check if it's for us
    if (gameState.pendingDecision) {
      return gameState.pendingDecision.player === myGamePlayerId;
    }
    return gameState.activePlayer === myGamePlayerId;
  })();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      roomRef.current?.leave();
      engineRef.current = null;
    };
  }, []);

  // Persist room state to localStorage (but not when game is over)
  useEffect(() => {
    if (isPlaying && events.length > 0 && !gameState?.gameOver) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        localStorage.setItem(STORAGE_ROOM_KEY, JSON.stringify({
          roomCode,
          myPeerId,
          isHost,
          players,
        }));
        setHasSavedSession(true);
      } catch (e) {
        console.error("[MultiplayerContext] Failed to save to localStorage:", e);
      }
    }
  }, [isPlaying, events, roomCode, myPeerId, isHost, players, gameState?.gameOver]);

  // Clear saved session when game ends
  useEffect(() => {
    if (gameState?.gameOver) {
      console.log("[MultiplayerContext] Game over detected, clearing saved session");
      console.log("[MultiplayerContext] Winner:", gameState.winner);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_ROOM_KEY);
      setHasSavedSession(false);
    }
  }, [gameState?.gameOver, gameState?.winner]);

  /**
   * Create room as host
   */
  const createRoom = useCallback(async (playerName: string): Promise<string> => {
    setError(null);
    setIsConnecting(true);

    // Clear any previous session
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_ROOM_KEY);

    try {
      const code = generateRoomCode();
      const room = new P2PRoom(code, true);
      roomRef.current = room;

      const peerId = room.getMyPeerId();
      if (!peerId) throw new Error("Failed to get peer ID");

      setMyPeerId(peerId);
      setRoomCode(code);
      setIsHost(true);
      setIsConnected(true);
      setIsConnecting(false);

      // Subscribe to state changes
      room.onStateChange((state) => {
        console.log(`[MultiplayerContext] Host state update: ${state.events.length} events, ${state.players.length} players, pendingUndo: ${state.pendingUndo ? 'pending' : 'null'}`);
        setRoomState(state);
      });

      // Get initial state immediately to populate UI
      const initialState = room.getState();
      console.log(`[MultiplayerContext] Initial host state: ${initialState.players.length} players`);
      setRoomState(initialState);

      // Set my name
      room.setMyName(playerName);

      // Save to localStorage for reconnect
      localStorage.setItem(STORAGE_ROOM_KEY, JSON.stringify({
        roomCode: code,
        myPeerId: peerId,
        isHost: true,
        players: [{ id: peerId, name: playerName, isAI: false, connected: true }],
      }));
      setHasSavedSession(true);

      return code;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create room";
      setError(message);
      setIsConnecting(false);
      throw e;
    }
  }, []);

  /**
   * Join existing room as client
   */
  const joinRoom = useCallback(
    async (code: string, playerName: string): Promise<void> => {
      setError(null);
      setIsConnecting(true);

      // Clear any previous session
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_ROOM_KEY);

      try {
        const room = new P2PRoom(code.toUpperCase(), false);
        roomRef.current = room;

        const peerId = room.getMyPeerId();
        if (!peerId) throw new Error("Failed to get peer ID");

        setMyPeerId(peerId);
        setRoomCode(code.toUpperCase());
        setIsHost(false);
        setIsConnected(true);
        setIsConnecting(false);

        // Set optimistic state immediately (will be replaced by real state)
        setRoomState({
          players: [
            { id: "host-placeholder", name: "Host", isAI: false, connected: true },
            { id: peerId, name: playerName, isAI: false, connected: true },
          ],
          gameState: null,
          events: [],
          pendingUndo: null,
          isStarted: false,
        });

        // Subscribe to state changes
        room.onStateChange((state) => {
          console.log(`[MultiplayerContext] Client state update: ${state.events.length} events, ${state.players.length} players, pendingUndo: ${state.pendingUndo ? 'pending' : 'null'}`);
          setRoomState(state);
        });

        // Subscribe to events and recompute state
        room.onEvents((newEvents) => {
          console.log(`[MultiplayerContext] Received ${newEvents.length} events`);
          // State will be updated via onStateChange
        });

        // Announce join (will queue until connection established)
        console.log(`[MultiplayerContext] Client announcing join to host`);
        room.setMyName(playerName);

        // Save to localStorage for reconnect
        localStorage.setItem(STORAGE_ROOM_KEY, JSON.stringify({
          roomCode: code.toUpperCase(),
          myPeerId: peerId,
          isHost: false,
          players: [{ id: peerId, name: playerName, isAI: false, connected: true }],
        }));
        setHasSavedSession(true);
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
   * Reconnect to saved room (after refresh)
   */
  const reconnectToSavedRoom = useCallback(async (): Promise<void> => {
    setError(null);
    setIsReconnecting(true);

    try {
      const savedEvents = localStorage.getItem(STORAGE_KEY);
      const savedRoom = localStorage.getItem(STORAGE_ROOM_KEY);

      if (!savedEvents || !savedRoom) {
        throw new Error("No saved session found");
      }

      const events = JSON.parse(savedEvents) as GameEvent[];
      const roomInfo = JSON.parse(savedRoom) as {
        roomCode: string;
        myPeerId: string;
        isHost: boolean;
        players: PlayerInfo[];
      };

      console.log("[MultiplayerContext] Reconnecting to room:", roomInfo.roomCode, "as", roomInfo.isHost ? "host" : "client", "with saved peerId:", roomInfo.myPeerId);

      // Create new room connection with SAVED peerId (critical for player mapping)
      const room = new P2PRoom(roomInfo.roomCode, roomInfo.isHost, roomInfo.myPeerId);
      roomRef.current = room;

      const peerId = room.getMyPeerId();
      if (!peerId) throw new Error("Failed to get peer ID");
      if (peerId !== roomInfo.myPeerId) {
        console.warn("[MultiplayerContext] peerId mismatch! Saved:", roomInfo.myPeerId, "Got:", peerId);
      }

      setMyPeerId(roomInfo.myPeerId); // Use saved peerId
      setRoomCode(roomInfo.roomCode);
      setIsHost(roomInfo.isHost);
      setIsConnected(true);

      // Restore local state immediately (before async network sync)
      const restoredGameState = projectState(events);
      console.log("[MultiplayerContext] Restored game state:", {
        turn: restoredGameState.turn,
        activePlayer: restoredGameState.activePlayer,
        phase: restoredGameState.phase,
        pendingDecision: !!restoredGameState.pendingDecision,
      });

      const initialRoomState = {
        players: roomInfo.players,
        gameState: restoredGameState,
        events,
        pendingUndo: null,
        isStarted: true,
      };
      setRoomState(initialRoomState);

      // Subscribe to state changes (will update when peers connect)
      room.onStateChange((state) => {
        console.log(`[MultiplayerContext] Room state update: ${state.events.length} events, ${state.players.length} players`);
        // Only update if the state has meaningful data (not empty from room initialization)
        if (state.players.length > 0 || state.events.length > 0) {
          setRoomState(state);
        }
      });

      // If host, recreate engine from saved events
      if (roomInfo.isHost) {
        syncEventCounter(events);
        const engine = new DominionEngine();
        engineRef.current = engine;

        // Load saved events
        engine.loadEvents(events);
        const engineState = engine.state;

        console.log("[MultiplayerContext] Host restored engine with", events.length, "events");

        // Restore players BEFORE starting game (critical!)
        room.restorePlayers(roomInfo.players);

        // Update room with restored state and events
        room.startGameWithEvents(engineState, events);

        // Subscribe to future events
        engine.subscribe((newEvents, state) => {
          console.log(`[MultiplayerContext] Engine emitted ${newEvents.length} events`);
          room.broadcastEvents(newEvents, state);
        });

        // Handle commands from clients
        room.onCommand((command, customPlayerId) => {
          console.log(`[MultiplayerContext] Processing command from ${customPlayerId}:`, command.type);

          // Handle undo commands
          if (command.type === "REQUEST_UNDO") {
            room.requestUndo(customPlayerId, command.toEventId, command.reason);
            return;
          }
          if (command.type === "APPROVE_UNDO") {
            console.log(`[MultiplayerContext] (Reconnect) Processing APPROVE_UNDO from ${customPlayerId}`);
            const wasExecuted = room.approveUndo(customPlayerId);

            console.log(`[MultiplayerContext] (Reconnect) After approval, wasExecuted:`, wasExecuted);

            if (wasExecuted) {
              const newEvents = room.getEvents();
              console.log(`[MultiplayerContext] (Reconnect) Undo executed! Reloading engine with ${newEvents.length} events`);

              // Sync event counter to the highest ID in the truncated log
              syncEventCounter(newEvents);

              const newState = projectState(newEvents);
              room.setGameStateAfterUndo(newState);
              engine.loadEventsSilently(newEvents);

              // Broadcast full state (events were truncated, clients need full sync)
              console.log(`[MultiplayerContext] (Reconnect) Broadcasting full state after undo, activePlayer: ${newState.activePlayer}`);
              room.broadcastFullState();
            }
            return;
          }
          if (command.type === "DENY_UNDO") {
            room.denyUndo();
            return;
          }

          // Regular commands
          // Map custom player ID to game player ID (player0, player1, etc.)
          const playerIndex = roomInfo.players.findIndex(p => p.id === customPlayerId);
          if (playerIndex < 0) {
            console.error(`[MultiplayerContext] Unknown custom player ID: ${customPlayerId}`);
            return;
          }

          const gamePlayerId = `player${playerIndex}` as Player;
          const commandPlayerId = 'player' in command ? command.player : undefined;

          if (commandPlayerId && commandPlayerId !== gamePlayerId) {
            console.error(`[MultiplayerContext] Player ID mismatch! Custom player ${customPlayerId} (game ${gamePlayerId}) sent command for ${commandPlayerId}`);
            return;
          }

          // Dispatch with the game player ID
          engine.dispatch(command, commandPlayerId || gamePlayerId);
        });
      } else {
        // Client: Initialize local engine from saved events
        syncEventCounter(events);
        const engine = new DominionEngine();
        engineRef.current = engine;
        engine.loadEvents(events);

        console.log("[MultiplayerContext] Client restored engine with", events.length, "events");

        // Restore players in room (so getState() works correctly)
        room.restorePlayers(roomInfo.players);

        // Subscribe to events from host
        room.onEvents((newEvents) => {
          console.log(`[MultiplayerContext] Client received ${newEvents.length} events, applying locally`);
          // Apply to local engine
          engine.applyExternalEvents(newEvents);

          // Update room state from engine
          const newState = engine.state;
          setRoomState({
            players: roomInfo.players,
            gameState: newState,
            events: [...engine.eventLog],
            pendingUndo: null,
            isStarted: true,
          });
        });
      }

      // Set name (will trigger rejoin message to host)
      const myName = roomInfo.players.find(p => p.id === roomInfo.myPeerId)?.name || "Player";
      room.setMyName(myName);

      setIsReconnecting(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to reconnect";
      setError(message);
      setIsReconnecting(false);

      // Clear saved session if reconnect fails
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_ROOM_KEY);
      setHasSavedSession(false);

      throw e;
    }
  }, []);

  /**
   * Leave room
   */
  const leaveRoom = useCallback(() => {
    const wasHost = isHost;

    if (wasHost) {
      // Host leaving - end the game for everyone
      roomRef.current?.endGame("Host left the room");
    }

    roomRef.current?.leave();
    roomRef.current = null;
    engineRef.current = null;

    setIsConnected(false);
    setRoomCode(null);
    setMyPeerId(null);
    setIsHost(false);
    setRoomState({ players: [], gameState: null, events: [], pendingUndo: null, isStarted: false });
    setError(null);

    // Clear localStorage to prevent rejoining
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_ROOM_KEY);
    setHasSavedSession(false);
  }, [isHost]);

  /**
   * End game (anyone can call)
   */
  const endGame = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    // Broadcast game end - this will set gameOver flag
    room.endGame("Player ended game");

    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_ROOM_KEY);
    setHasSavedSession(false);

    // Don't leave immediately - let the game over modal show
  }, []);


  /**
   * Update my name
   */
  const setMyName = useCallback((name: string) => {
    roomRef.current?.setMyName(name);
  }, []);

  /**
   * Start game (host only)
   */
  const startGame = useCallback(() => {
    const room = roomRef.current;
    if (!room || !isHost) return;

    // Create the engine
    resetEventCounter();
    const engine = new DominionEngine();
    engineRef.current = engine;

    // Start game with player IDs
    const playerIds = players.map((_, i) => `player${i}` as Player);
    engine.startGame(playerIds);

    // Get initial state and events
    const initialState = engine.state;
    const initialEvents = [...engine.eventLog];

    console.log(`[MultiplayerContext] Starting game with ${playerIds.length} players, ${initialEvents.length} events`);

    // Broadcast to room
    room.startGameWithEvents(initialState, initialEvents);

    // Subscribe to engine changes for future broadcasts
    engine.subscribe((newEvents, state) => {
      console.log(`[MultiplayerContext] Engine emitted ${newEvents.length} events`);
      room.broadcastEvents(newEvents, state);
    });

    // Handle commands from clients
    room.onCommand((command, customPlayerId) => {
      console.log(`[MultiplayerContext] Processing command from ${customPlayerId}:`, command.type);

      // Handle undo commands specially
      if (command.type === "REQUEST_UNDO") {
        room.requestUndo(customPlayerId, command.toEventId, command.reason);
        return;
      }

      if (command.type === "APPROVE_UNDO") {
        console.log(`[MultiplayerContext] Processing APPROVE_UNDO from ${customPlayerId}`);
        const wasExecuted = room.approveUndo(customPlayerId);

        console.log(`[MultiplayerContext] After approval, wasExecuted:`, wasExecuted);

        if (wasExecuted) {
          const newEvents = room.getEvents();
          console.log(`[MultiplayerContext] Undo executed! Reloading engine with ${newEvents.length} events`);

          // Sync event counter to the highest ID in the truncated log
          syncEventCounter(newEvents);

          const newState = projectState(newEvents);
          console.log(`[MultiplayerContext] Recomputed state:`, {
            turn: newState.turn,
            phase: newState.phase,
            activePlayer: newState.activePlayer,
            actions: newState.actions,
            buys: newState.buys,
            coins: newState.coins,
          });
          room.setGameStateAfterUndo(newState);

          // Reload engine WITHOUT triggering event notifications
          // (We don't want to re-broadcast events that are already in the room)
          engine.loadEventsSilently(newEvents);

          // Broadcast full state (events were truncated, clients need full sync)
          console.log(`[MultiplayerContext] Broadcasting full state after undo`);
          room.broadcastFullState();
        }
        return;
      }

      if (command.type === "DENY_UNDO") {
        room.denyUndo();
        return;
      }

      // Regular game commands
      // Map custom player ID to game player ID (player0, player1, etc.)
      const playerIndex = players.findIndex(p => p.id === customPlayerId);
      if (playerIndex < 0) {
        console.error(`[MultiplayerContext] Unknown custom player ID: ${customPlayerId}`);
        return;
      }

      const gamePlayerId = `player${playerIndex}` as Player;
      const commandPlayerId = 'player' in command ? command.player : undefined;

      if (commandPlayerId && commandPlayerId !== gamePlayerId) {
        console.error(`[MultiplayerContext] Player ID mismatch! Custom player ${customPlayerId} (game ${gamePlayerId}) sent command for ${commandPlayerId}`);
        return;
      }

      // Dispatch with the game player ID
      engine.dispatch(command, commandPlayerId || gamePlayerId);
    });
  }, [isHost, players]);


  // Game actions
  const playAction = useCallback((card: CardName): CommandResult => {
    if (!myGamePlayerId) return { ok: false, error: "Not in game" };

    if (isHost && engineRef.current) {
      return engineRef.current.playAction(myGamePlayerId, card);
    }

    if (!isHost && roomRef.current) {
      roomRef.current.sendCommandToHost({ type: "PLAY_ACTION", player: myGamePlayerId, card });
      return { ok: true, events: [] };
    }

    return { ok: false, error: "Not connected" };
  }, [isHost, myGamePlayerId]);

  const playTreasure = useCallback((card: CardName): CommandResult => {
    if (!myGamePlayerId) return { ok: false, error: "Not in game" };

    if (isHost && engineRef.current) {
      return engineRef.current.playTreasure(myGamePlayerId, card);
    }

    if (!isHost && roomRef.current) {
      roomRef.current.sendCommandToHost({ type: "PLAY_TREASURE", player: myGamePlayerId, card });
      return { ok: true, events: [] };
    }

    return { ok: false, error: "Not connected" };
  }, [isHost, myGamePlayerId]);

  const playAllTreasures = useCallback((): CommandResult => {
    if (!myGamePlayerId) return { ok: false, error: "Not in game" };

    if (isHost && engineRef.current) {
      return engineRef.current.playAllTreasures(myGamePlayerId);
    }

    if (!isHost && roomRef.current) {
      roomRef.current.sendCommandToHost({ type: "PLAY_ALL_TREASURES", player: myGamePlayerId });
      return { ok: true, events: [] };
    }

    return { ok: false, error: "Not connected" };
  }, [isHost, myGamePlayerId]);

  const buyCard = useCallback((card: CardName): CommandResult => {
    if (!myGamePlayerId) return { ok: false, error: "Not in game" };

    if (isHost && engineRef.current) {
      return engineRef.current.buyCard(myGamePlayerId, card);
    }

    if (!isHost && roomRef.current) {
      roomRef.current.sendCommandToHost({ type: "BUY_CARD", player: myGamePlayerId, card });
      return { ok: true, events: [] };
    }

    return { ok: false, error: "Not connected" };
  }, [isHost, myGamePlayerId]);

  const endPhase = useCallback((): CommandResult => {
    if (!myGamePlayerId) return { ok: false, error: "Not in game" };

    if (isHost && engineRef.current) {
      return engineRef.current.endPhase(myGamePlayerId);
    }

    if (!isHost && roomRef.current) {
      roomRef.current.sendCommandToHost({ type: "END_PHASE", player: myGamePlayerId });
      return { ok: true, events: [] };
    }

    return { ok: false, error: "Not connected" };
  }, [isHost, myGamePlayerId]);

  const submitDecision = useCallback((choice: DecisionChoice): CommandResult => {
    if (!gameState?.pendingDecision || !myGamePlayerId) {
      return { ok: false, error: "No pending decision" };
    }

    const decisionPlayer = gameState.pendingDecision.player;

    if (isHost && engineRef.current) {
      return engineRef.current.submitDecision(decisionPlayer, choice);
    }

    if (!isHost && roomRef.current) {
      roomRef.current.sendCommandToHost({ type: "SUBMIT_DECISION", player: decisionPlayer, choice });
      return { ok: true, events: [] };
    }

    return { ok: false, error: "Not connected" };
  }, [isHost, myGamePlayerId, gameState?.pendingDecision]);

  // Undo actions
  const requestUndo = useCallback((toEventId: string, reason?: string) => {
    const room = roomRef.current;
    if (!room || !myPeerId) return;

    console.log(`[MultiplayerContext] requestUndo called with toEventId: ${toEventId}, reason: ${reason}`);

    if (isHost) {
      // Host: Update locally and broadcast
      room.requestUndo(myPeerId, toEventId, reason);
    } else {
      // Client: Send command to host
      console.log(`[MultiplayerContext] Client sending REQUEST_UNDO for event ${toEventId}`);
      room.sendCommandToHost({
        type: "REQUEST_UNDO",
        player: myPeerId as Player,
        toEventId,
        reason,
      });
    }
  }, [myPeerId, isHost]);

  const approveUndo = useCallback(() => {
    const room = roomRef.current;
    const engine = engineRef.current;
    if (!room || !myPeerId || !pendingUndo) return;

    console.log(`[MultiplayerContext] approveUndo called by ${isHost ? "host" : "client"}, myPeerId: ${myPeerId}`);

    if (isHost) {
      // Host: Approve locally
      const wasExecuted = room.approveUndo(myPeerId);

      console.log(`[MultiplayerContext] Host approval, wasExecuted:`, wasExecuted);

      if (engine && wasExecuted) {
        const newEvents = room.getEvents();
        console.log(`[MultiplayerContext] Host reloading engine with ${newEvents.length} events`);

        // Sync event counter to the highest ID in the truncated log
        syncEventCounter(newEvents);

        const newState = projectState(newEvents);
        room.setGameStateAfterUndo(newState);
        engine.loadEventsSilently(newEvents);

        // Broadcast full state (events were truncated, clients need full sync)
        console.log(`[MultiplayerContext] Host broadcasting full state after undo, activePlayer: ${newState.activePlayer}`);
        room.broadcastFullState();
      }
    } else {
      // Client: Send approval to host
      console.log(`[MultiplayerContext] Client sending APPROVE_UNDO to host`);
      room.sendCommandToHost({
        type: "APPROVE_UNDO",
        player: myPeerId,
        requestId: pendingUndo.requestId,
      });
    }
  }, [myPeerId, isHost, pendingUndo]);

  const denyUndo = useCallback(() => {
    const room = roomRef.current;
    if (!room || !myPeerId || !pendingUndo) return;

    if (isHost) {
      room.denyUndo();
    } else {
      room.sendCommandToHost({
        type: "DENY_UNDO",
        player: myPeerId,
        requestId: pendingUndo.requestId,
      });
    }
  }, [myPeerId, isHost, pendingUndo]);

  // Time travel
  const getStateAtEvent = useCallback((eventId: string): GameState => {
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      throw new Error(`Event ${eventId} not found`);
    }
    return projectState(events.slice(0, eventIndex + 1));
  }, [events]);

  const value: MultiplayerContextValue = {
    // Connection
    isConnected,
    isConnecting,
    isReconnecting,
    roomCode,
    error,
    hasSavedSession,

    // Player info
    myPeerId,
    myPlayerIndex,
    myGamePlayerId,
    isHost,

    // Room state
    players,
    gameState,
    events,
    pendingUndo,
    isInLobby,
    isPlaying,
    isMyTurn,

    // Lobby actions
    createRoom,
    joinRoom,
    reconnectToSavedRoom,
    leaveRoom,
    endGame,
    setMyName,
    startGame,

    // Game actions
    playAction,
    playTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,

    // Undo / Time travel
    requestUndo,
    approveUndo,
    denyUndo,
    getStateAtEvent,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}
