/**
 * Simple P2P Room using Trystero
 *
 * Host-authoritative: Host runs game engine, broadcasts events to clients.
 * Event-driven: Game state is derived from event log.
 */
import { joinRoom as joinTrysteroRoom, type Room } from "trystero/torrent";
import type { GameState } from "../types/game-state";
import type { GameEvent } from "../events/types";
import type { GameCommand } from "../commands/types";
import { projectState } from "../events/project";
import { removeEventChain } from "../events/types";
import { multiplayerLogger } from "../lib/logger";

const APP_ID = "dominion-maker-p2p-v2"; // Bumped version for event-driven

const RANDOM_ID_RADIX = 36;
const RANDOM_ID_SLICE_START = 2;
const ROOM_CODE_LENGTH = 6;

export interface PlayerInfo {
  id: string;
  name: string;
  isAI: boolean;
  connected: boolean;
}

export interface PendingUndoRequest {
  requestId: string;
  byPlayer: string;
  toEventId: string;
  reason?: string;
  approvals: string[];
  needed: number;
}

export interface RoomState {
  players: PlayerInfo[];
  gameState: GameState | null;
  events: GameEvent[];
  pendingUndo: PendingUndoRequest | null;
  isStarted: boolean;
}

type StateUpdateHandler = (state: RoomState) => void;
type EventHandler = (events: GameEvent[]) => void;
type CommandHandler = (command: GameCommand, fromPlayerId: string) => void;

export class P2PRoom {
  private room: Room;
  private isHost: boolean;
  private myPeerId: string | null = null;

  private players: Map<string, PlayerInfo> = new Map(); // Keyed by custom player ID
  private trysteroToPlayerId: Map<string, string> = new Map(); // Map Trystero peer ID -> custom player ID
  private gameState: GameState | null = null;
  private events: GameEvent[] = [];
  private pendingUndo: PendingUndoRequest | null = null;
  private isStarted = false;

  private stateHandlers: Set<StateUpdateHandler> = new Set();
  private eventHandlers: Set<EventHandler> = new Set();
  private commandHandlers: Set<CommandHandler> = new Set();

  // Client connection tracking
  private isConnectedToHost = false;
  private pendingJoinName: string | null = null;

  // Trystero channels
  private sendFullState: (state: RoomState, peerId?: string) => void;
  private sendEvents: (events: GameEvent[], peerId?: string) => void;
  private sendCommand: (command: GameCommand, peerId?: string) => void;
  private sendJoin: (
    info: { playerId: string; name: string },
    peerId?: string,
  ) => void;
  private sendGameEnd: (data: { reason: string }, peerId?: string) => void;

  constructor(roomCode: string, isHost: boolean, savedPeerId?: string) {
    this.isHost = isHost;
    this.myPeerId = savedPeerId || crypto.randomUUID();

    multiplayerLogger.debug(
      `Creating room: ${roomCode}, isHost: ${isHost}, myPeerId: ${this.myPeerId}${savedPeerId ? " (restored)" : " (new)"}`,
    );

    this.room = this.createTrysteroRoom(roomCode);
    this.setupPeerHandlers();
    this.setupMessageChannels();
    this.initializeHostPlayer();
  }

  private createTrysteroRoom(roomCode: string): Room {
    return joinTrysteroRoom(
      {
        appId: APP_ID,
        trackerUrls: [
          "wss://tracker.openwebtorrent.com",
          "wss://tracker.webtorrent.dev",
          "wss://tracker.files.fm:7073/announce",
          "wss://spacetradersapi-chatbox.herokuapp.com:443/announce",
        ],
      },
      roomCode,
    );
  }

  private setupPeerHandlers(): void {
    this.room.onPeerJoin(trysteroPeerId => {
      multiplayerLogger.debug(`✅ Trystero peer connected: ${trysteroPeerId}`);

      if (this.isHost) {
        const state = this.getState();
        multiplayerLogger.debug(
          `Sending initial state to new peer: ${state.players.length} players`,
        );
        this.sendFullState(state, trysteroPeerId);
      }
    });

    this.room.onPeerLeave(trysteroPeerId => {
      this.handlePeerLeave(trysteroPeerId);
    });
  }

  private handlePeerLeave(trysteroPeerId: string): void {
    multiplayerLogger.debug(`Trystero peer left: ${trysteroPeerId}`);

    if (this.isHost) {
      const playerId = this.trysteroToPlayerId.get(trysteroPeerId);
      if (playerId) {
        const player = this.players.get(playerId);
        if (player) {
          if (this.isStarted) {
            player.connected = false;
            player.isAI = true;
          } else {
            this.players.delete(playerId);
          }
          this.trysteroToPlayerId.delete(trysteroPeerId);
          this.broadcastState();
        }
      }
      return;
    }
    this.players.clear();
    this.notifyStateChange();
  }

  private setupMessageChannels(): void {
    // @ts-expect-error - RoomState has complex nested types that don't match JsonValue constraint
    const [sendFullState, receiveFullState] =
      this.room.makeAction<RoomState>("fullState");
    // @ts-expect-error - GameEvent[] has complex nested types that don't match JsonValue constraint
    const [sendEvents, receiveEvents] =
      this.room.makeAction<GameEvent[]>("events");
    const [sendCommand, receiveCommand] =
      this.room.makeAction<GameCommand>("command");
    const [sendJoin, receiveJoin] = this.room.makeAction<{
      playerId: string;
      name: string;
    }>("join");
    const [sendGameEnd, receiveGameEnd] = this.room.makeAction<{
      reason: string;
    }>("gameEnd");

    this.sendFullState = sendFullState;
    this.sendEvents = sendEvents;
    this.sendCommand = sendCommand;
    this.sendJoin = sendJoin;
    this.sendGameEnd = sendGameEnd;

    this.setupFullStateReceiver(receiveFullState);
    this.setupEventsReceiver(receiveEvents);
    this.setupCommandReceiver(receiveCommand);
    this.setupJoinReceiver(receiveJoin);
    this.setupGameEndReceiver(receiveGameEnd);
  }

  private setupFullStateReceiver(
    receiveFullState: (
      handler: (state: RoomState, peerId: string) => void,
    ) => void,
  ): void {
    receiveFullState((state, peerId) => {
      if (this.isHost) return;

      multiplayerLogger.debug(
        `Received full state from ${peerId}: ${state.players.length} players, ${state.events.length} events, pendingUndo: ${state.pendingUndo?.requestId || "none"}`,
      );
      this.players = new Map(state.players.map((p: PlayerInfo) => [p.id, p]));
      this.events = state.events;
      this.pendingUndo = state.pendingUndo;
      this.isStarted = state.isStarted;

      this.gameState =
        state.events.length > 0 ? projectState(state.events) : state.gameState;

      multiplayerLogger.debug(`Client recomputed state:`, {
        turn: this.gameState?.turn,
        phase: this.gameState?.phase,
        activePlayer: this.gameState?.activePlayer,
      });

      this.notifyStateChange();
      this.isConnectedToHost = true;

      if (this.pendingJoinName && this.myPeerId) {
        multiplayerLogger.debug(
          `Connection established, sending pending join message`,
        );
        this.sendJoin({
          playerId: this.myPeerId,
          name: this.pendingJoinName,
        });
        this.pendingJoinName = null;
      }
    });
  }

  private setupEventsReceiver(
    receiveEvents: (
      handler: (events: GameEvent[], peerId: string) => void,
    ) => void,
  ): void {
    receiveEvents((newEvents: GameEvent[], peerId) => {
      if (this.isHost) return;

      multiplayerLogger.debug(
        `Received ${newEvents.length} events from ${peerId}, total: ${this.events.length + newEvents.length}`,
      );
      this.events.push(...newEvents);
      this.gameState = projectState(this.events);
      Array.from(this.eventHandlers).map(handler => handler(newEvents));
      this.notifyStateChange();
    });
  }

  private setupCommandReceiver(
    receiveCommand: (
      handler: (command: GameCommand, peerId: string) => void,
    ) => void,
  ): void {
    receiveCommand((command, trysteroPeerId) => {
      if (!this.isHost) return;

      const playerId = this.trysteroToPlayerId.get(trysteroPeerId);
      if (!playerId) {
        multiplayerLogger.error(
          `Received command from unknown Trystero peer: ${trysteroPeerId}`,
        );
        return;
      }
      multiplayerLogger.debug(
        `Received command from ${playerId} (Trystero: ${trysteroPeerId}):`,
        command.type,
      );
      Array.from(this.commandHandlers).map(handler =>
        handler(command, playerId),
      );
    });
  }

  private setupJoinReceiver(
    receiveJoin: (
      handler: (
        info: { playerId: string; name: string },
        peerId: string,
      ) => void,
    ) => void,
  ): void {
    receiveJoin((info, trysteroPeerId) => {
      multiplayerLogger.debug(
        `Player joined: ${info.playerId} (Trystero: ${trysteroPeerId}) - ${info.name}`,
      );

      if (!this.isHost) return;

      this.trysteroToPlayerId.set(trysteroPeerId, info.playerId);
      this.players.set(info.playerId, {
        id: info.playerId,
        name: info.name,
        isAI: false,
        connected: true,
      });
      this.broadcastState();
    });
  }

  private setupGameEndReceiver(
    receiveGameEnd: (
      handler: (data: { reason: string }, peerId: string) => void,
    ) => void,
  ): void {
    receiveGameEnd(data => {
      multiplayerLogger.debug(`Game ended by peer: ${data.reason}`);

      if (this.gameState) {
        this.gameState = {
          ...this.gameState,
          gameOver: true,
          winner: null,
        };
      }

      this.notifyStateChange();
    });
  }

  private initializeHostPlayer(): void {
    if (this.isHost && this.myPeerId) {
      this.players.set(this.myPeerId, {
        id: this.myPeerId,
        name: "Host",
        isAI: false,
        connected: true,
      });
    }
  }

  /**
   * Get my peer ID
   */
  getMyPeerId(): string | null {
    return this.myPeerId;
  }

  /**
   * Update my player name
   */
  setMyName(name: string): void {
    if (!this.myPeerId) {
      multiplayerLogger.warn(`setMyName called but myPeerId is null`);
      return;
    }

    if (this.isHost) {
      multiplayerLogger.debug(`Host setting name: ${name}`);
      const me = this.players.get(this.myPeerId);
      if (me) {
        me.name = name;
        this.broadcastState();
      }
    } else {
      // Client: Wait for connection before sending join
      if (this.isConnectedToHost) {
        multiplayerLogger.debug(
          `Client sending join message: ${this.myPeerId} - ${name}`,
        );
        this.sendJoin({ playerId: this.myPeerId, name });
      } else {
        multiplayerLogger.debug(
          `Client queuing join message (not connected yet): ${name}`,
        );
        this.pendingJoinName = name;
      }
    }
  }

  /**
   * Get current room state
   */
  getState(): RoomState {
    return {
      players: Array.from(this.players.values()),
      gameState: this.gameState,
      events: [...this.events], // Create new array for React reactivity
      pendingUndo: this.pendingUndo,
      isStarted: this.isStarted,
    };
  }

  /**
   * Get event log
   */
  getEvents(): GameEvent[] {
    return this.events;
  }

  /**
   * Restore players (for reconnection)
   */
  restorePlayers(players: PlayerInfo[]): void {
    this.players.clear();
    players.map(player => this.players.set(player.id, player));
    multiplayerLogger.debug(`Restored ${this.players.size} players`);
  }

  /**
   * Start the game with initial events (host only)
   */
  startGameWithEvents(
    initialState: GameState,
    initialEvents: GameEvent[],
  ): void {
    if (!this.isHost) return;

    multiplayerLogger.debug(
      `Starting game with ${this.players.size} players, ${initialEvents.length} initial events`,
    );
    this.gameState = initialState;
    this.events = initialEvents;
    this.isStarted = true;
    this.broadcastFullState();
  }

  /**
   * Broadcast new events and updated state (host only)
   */
  broadcastEvents(newEvents: GameEvent[], newState: GameState): void {
    if (!this.isHost) return;

    multiplayerLogger.debug(`Broadcasting ${newEvents.length} events`);
    this.events.push(...newEvents);
    this.gameState = newState;

    // Send incremental events to clients
    this.sendEvents(newEvents);
    this.notifyStateChange();
  }

  /**
   * Send command to host (client only)
   */
  sendCommandToHost(command: GameCommand): void {
    if (this.isHost) return;

    multiplayerLogger.debug(`Sending command to host:`, command.type);
    this.sendCommand(command);
  }

  /**
   * Request undo (anyone can request)
   */
  requestUndo(playerId: string, toEventId: string, reason?: string): void {
    const requestId = `undo_${Date.now()}_${Math.random().toString(RANDOM_ID_RADIX).slice(RANDOM_ID_SLICE_START)}`;
    const playerCount = this.players.size;

    multiplayerLogger.debug(
      `Undo requested by ${playerId} to event ${toEventId}, needs ${playerCount - 1} approvals`,
    );

    this.pendingUndo = {
      requestId,
      byPlayer: playerId,
      toEventId,
      reason,
      approvals: [],
      needed: playerCount - 1, // All opponents must approve
    };

    this.broadcastState();
  }

  /**
   * Approve pending undo request
   * Returns true if undo was executed (caller should recompute state and broadcast)
   */
  approveUndo(playerId: string): boolean {
    if (!this.pendingUndo) {
      multiplayerLogger.debug(`approveUndo called but no pending undo`);
      return false;
    }
    if (this.pendingUndo.approvals.includes(playerId)) {
      multiplayerLogger.debug(
        `${playerId} already approved (current approvals:`,
        this.pendingUndo.approvals,
        `)`,
      );
      return false;
    }

    multiplayerLogger.debug(
      `${playerId} approved undo (${this.pendingUndo.approvals.length + 1}/${this.pendingUndo.needed})`,
    );
    multiplayerLogger.debug(
      `Current approvals:`,
      this.pendingUndo.approvals,
      `+ ${playerId}`,
    );
    this.pendingUndo.approvals.push(playerId);

    // Check if we have enough approvals
    if (this.pendingUndo.approvals.length >= this.pendingUndo.needed) {
      // Execute undo - remove causal chain
      const toEventId = this.pendingUndo.toEventId;
      const eventsBefore = this.events.length;
      multiplayerLogger.debug(
        `✓ Undo approved! Removing event chain for ${toEventId}, events before: ${eventsBefore}`,
      );

      // Find the target event index
      const targetIndex = this.events.findIndex(e => e.id === toEventId);
      const targetEvent = this.events[targetIndex];
      multiplayerLogger.debug(
        `Removing event ${toEventId} at index ${targetIndex} and all events after it`,
      );
      multiplayerLogger.debug(`Target event:`, targetEvent);

      // Remove the target event and everything after it
      this.events = removeEventChain(toEventId, this.events);
      const eventsAfter = this.events.length;
      multiplayerLogger.debug(
        `Events after removal: ${eventsAfter} (removed ${eventsBefore - eventsAfter})`,
      );
      this.pendingUndo = null;

      // Return true - caller must recompute state and broadcast
      multiplayerLogger.debug(
        `Undo executed, returning control to caller for state recomputation`,
      );
      return true;
    }
    multiplayerLogger.debug(
      `Waiting for more approvals... (need ${this.pendingUndo.needed - this.pendingUndo.approvals.length} more)`,
    );
    this.broadcastState();
    return false;
  }

  /**
   * Deny pending undo request
   */
  denyUndo(): void {
    multiplayerLogger.debug(`Undo denied`);
    this.pendingUndo = null;
    this.broadcastState();
  }

  /**
   * Update game state when events are truncated
   */
  setGameStateAfterUndo(newState: GameState): void {
    this.gameState = newState;
  }

  /**
   * Get pending undo request
   */
  getPendingUndo(): PendingUndoRequest | null {
    return this.pendingUndo;
  }

  private broadcastState(): void {
    if (!this.isHost) return;
    this.broadcastFullState();
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(handler: StateUpdateHandler): () => void {
    this.stateHandlers.add(handler);
    return () => this.stateHandlers.delete(handler);
  }

  /**
   * Subscribe to incoming events (clients)
   */
  onEvents(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Subscribe to incoming commands (host only)
   */
  onCommand(handler: CommandHandler): () => void {
    this.commandHandlers.add(handler);
    return () => this.commandHandlers.delete(handler);
  }

  /**
   * End the game and notify all players (anyone can call)
   */
  endGame(reason: string = "Player ended game"): void {
    multiplayerLogger.debug(
      `${this.isHost ? "Host" : "Client"} ending game: ${reason}`,
    );

    // Broadcast game end to all peers
    this.sendGameEnd({ reason });

    // Set our own game state to game over
    if (this.gameState) {
      this.gameState = {
        ...this.gameState,
        gameOver: true,
        winner: null,
      };
    }

    this.notifyStateChange();
  }

  /**
   * Leave the room
   */
  leave(): void {
    void this.room.leave();
  }

  /**
   * Broadcast full state to all peers (host only) - PUBLIC for use after undo
   */
  broadcastFullState(): void {
    if (!this.isHost) return;

    const state = this.getState();
    multiplayerLogger.debug(
      `Broadcasting full state: ${this.players.size} players, ${this.events.length} events`,
    );
    multiplayerLogger.debug(`Broadcasting game state:`, {
      turn: state.gameState?.turn,
      phase: state.gameState?.phase,
      activePlayer: state.gameState?.activePlayer,
      pendingUndo: state.pendingUndo ? "pending" : "null",
    });
    this.sendFullState(state);
    this.notifyStateChange();
  }

  /**
   * Notify local state change handlers
   */
  private notifyStateChange(): void {
    const state = this.getState();
    Array.from(this.stateHandlers).map(handler => handler(state));
  }
}

/**
 * Generate a 6-character room code
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: ROOM_CODE_LENGTH },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}
