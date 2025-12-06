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

const APP_ID = "dominion-maker-p2p-v2"; // Bumped version for event-driven

export interface PlayerInfo {
  id: string;
  name: string;
  isAI: boolean;
  connected: boolean;
}

export interface PendingUndoRequest {
  requestId: string;
  byPlayer: string;
  toEventIndex: number;
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
  private roomCode: string;
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
  private sendJoin: (info: { playerId: string; name: string }, peerId?: string) => void;
  private sendUndoUpdate: (update: { type: "request" | "approve" | "deny" | "execute"; data: any }, peerId?: string) => void;
  private sendGameEnd: (data: { reason: string }, peerId?: string) => void;

  constructor(roomCode: string, isHost: boolean, savedPeerId?: string) {
    this.roomCode = roomCode;
    this.isHost = isHost;

    // Use saved peer ID if reconnecting, otherwise generate new one
    this.myPeerId = savedPeerId || crypto.randomUUID();

    console.log(`[P2PRoom] Creating room: ${roomCode}, isHost: ${isHost}, myPeerId: ${this.myPeerId}${savedPeerId ? " (restored)" : " (new)"}`);

    // Join Trystero room
    this.room = joinTrysteroRoom({ appId: APP_ID }, roomCode);

    // When a peer connects, send them our current state (host only)
    this.room.onPeerJoin((trysteroPeerId) => {
      console.log(`[P2PRoom] ✅ Trystero peer connected: ${trysteroPeerId}`);

      if (this.isHost) {
        // Send current state to the newly connected peer immediately
        const state = this.getState();
        console.log(`[P2PRoom] Sending initial state to new peer: ${state.players.length} players`);
        this.sendFullState(state, trysteroPeerId);
      }
    });

    // Set up message channels
    const [sendFullState, receiveFullState] = this.room.makeAction<RoomState>("fullState");
    const [sendEvents, receiveEvents] = this.room.makeAction<GameEvent[]>("events");
    const [sendCommand, receiveCommand] = this.room.makeAction<GameCommand>("command");
    const [sendJoin, receiveJoin] = this.room.makeAction<{ playerId: string; name: string }>("join");
    const [sendGameEnd, receiveGameEnd] = this.room.makeAction<{ reason: string }>("gameEnd");
    const [sendUndoUpdate, receiveUndoUpdate] = this.room.makeAction<{ type: string; data: any }>("undo");

    this.sendFullState = sendFullState;
    this.sendEvents = sendEvents;
    this.sendCommand = sendCommand;
    this.sendJoin = sendJoin;
    this.sendGameEnd = sendGameEnd;
    this.sendUndoUpdate = sendUndoUpdate;

    // Handle full state sync (for initial sync / rejoins)
    receiveFullState((state, peerId) => {
      if (!this.isHost) {
        console.log(`[P2PRoom] Received full state from ${peerId}: ${state.players.length} players, ${state.events.length} events, pendingUndo: ${state.pendingUndo?.requestId || "none"}`);
        this.players = new Map(state.players.map(p => [p.id, p]));
        this.events = state.events;
        this.pendingUndo = state.pendingUndo;
        this.isStarted = state.isStarted;

        // Recompute game state from events (important for undo)
        this.gameState = state.events.length > 0
          ? projectState(state.events)
          : state.gameState;

        this.notifyStateChange();

        // Mark as connected to host
        this.isConnectedToHost = true;

        // If we have a pending join name, send it now
        if (this.pendingJoinName && this.myPeerId) {
          console.log(`[P2PRoom] Connection established, sending pending join message`);
          this.sendJoin({ playerId: this.myPeerId, name: this.pendingJoinName });
          this.pendingJoinName = null;
        }
      }
    });

    // Handle incremental events (clients only)
    receiveEvents((newEvents, peerId) => {
      if (!this.isHost) {
        console.log(`[P2PRoom] Received ${newEvents.length} events from ${peerId}, total: ${this.events.length + newEvents.length}`);
        this.events.push(...newEvents);

        // Recompute game state from full event log
        this.gameState = projectState(this.events);

        // Notify event handlers
        for (const handler of this.eventHandlers) {
          handler(newEvents);
        }

        // Notify state change handlers
        this.notifyStateChange();
      }
    });

    // Handle commands from clients (host only)
    receiveCommand((command, peerId) => {
      if (this.isHost) {
        console.log(`[P2PRoom] Received command from ${peerId}:`, command.type);
        for (const handler of this.commandHandlers) {
          handler(command, peerId);
        }
      }
    });

    // Handle player joins
    receiveJoin((info, trysteroPeerId) => {
      console.log(`[P2PRoom] Player joined: ${info.playerId} (Trystero: ${trysteroPeerId}) - ${info.name}`);

      if (this.isHost) {
        // Map Trystero peer ID to custom player ID
        this.trysteroToPlayerId.set(trysteroPeerId, info.playerId);

        // Add player to our list using their custom player ID
        this.players.set(info.playerId, {
          id: info.playerId,
          name: info.name,
          isAI: false,
          connected: true,
        });

        // Broadcast updated state to all
        this.broadcastState();
      }
    });

    // Handle peer leaves
    this.room.onPeerLeave((trysteroPeerId) => {
      console.log(`[P2PRoom] Trystero peer left: ${trysteroPeerId}`);

      if (this.isHost) {
        // Look up custom player ID from Trystero peer ID
        const playerId = this.trysteroToPlayerId.get(trysteroPeerId);
        if (playerId) {
          const player = this.players.get(playerId);
          if (player) {
            if (this.isStarted) {
              // Mark as AI if game started
              player.connected = false;
              player.isAI = true;
            } else {
              // Remove if in lobby
              this.players.delete(playerId);
            }
            this.trysteroToPlayerId.delete(trysteroPeerId);
            this.broadcastState();
          }
        }
      } else {
        // If we're a client and host left, we're disconnected
        this.players.clear();
        this.notifyStateChange();
      }
    });

    // Handle game end broadcast (all peers)
    receiveGameEnd((data, _peerId) => {
      console.log(`[P2PRoom] Game ended by peer: ${data.reason}`);

      // Set game state to game over
      if (this.gameState) {
        this.gameState = {
          ...this.gameState,
          gameOver: true,
          winner: null,
        };
      }

      this.notifyStateChange();
    });

    // If host, add ourselves to players immediately
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
      console.warn(`[P2PRoom] setMyName called but myPeerId is null`);
      return;
    }

    if (this.isHost) {
      console.log(`[P2PRoom] Host setting name: ${name}`);
      const me = this.players.get(this.myPeerId);
      if (me) {
        me.name = name;
        this.broadcastState();
      }
    } else {
      // Client: Wait for connection before sending join
      if (this.isConnectedToHost) {
        console.log(`[P2PRoom] Client sending join message: ${this.myPeerId} - ${name}`);
        this.sendJoin({ playerId: this.myPeerId, name });
      } else {
        console.log(`[P2PRoom] Client queuing join message (not connected yet): ${name}`);
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
    for (const player of players) {
      this.players.set(player.id, player);
    }
    console.log(`[P2PRoom] Restored ${this.players.size} players`);
  }

  /**
   * Start the game with initial events (host only)
   */
  startGameWithEvents(initialState: GameState, initialEvents: GameEvent[]): void {
    if (!this.isHost) return;

    console.log(`[P2PRoom] Starting game with ${this.players.size} players, ${initialEvents.length} initial events`);
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

    console.log(`[P2PRoom] Broadcasting ${newEvents.length} events`);
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

    console.log(`[P2PRoom] Sending command to host:`, command.type);
    this.sendCommand(command);
  }

  /**
   * Request undo (anyone can request)
   */
  requestUndo(playerId: string, toEventIndex: number, reason?: string): void {
    const requestId = `undo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const playerCount = this.players.size;

    console.log(`[P2PRoom] Undo requested by ${playerId} to event ${toEventIndex}, needs ${playerCount - 1} approvals`);

    this.pendingUndo = {
      requestId,
      byPlayer: playerId,
      toEventIndex,
      reason,
      approvals: [],
      needed: playerCount - 1, // All opponents must approve
    };

    this.broadcastState();
  }

  /**
   * Approve pending undo request
   */
  approveUndo(playerId: string): void {
    if (!this.pendingUndo) {
      console.log(`[P2PRoom] approveUndo called but no pending undo`);
      return;
    }
    if (this.pendingUndo.approvals.includes(playerId)) {
      console.log(`[P2PRoom] ${playerId} already approved`);
      return;
    }

    console.log(`[P2PRoom] ${playerId} approved undo (${this.pendingUndo.approvals.length + 1}/${this.pendingUndo.needed})`);
    this.pendingUndo.approvals.push(playerId);

    // Check if we have enough approvals
    if (this.pendingUndo.approvals.length >= this.pendingUndo.needed) {
      // Execute undo - truncate events
      const toIndex = this.pendingUndo.toEventIndex;
      console.log(`[P2PRoom] ✓ Undo approved! Truncating events from ${this.events.length} to ${toIndex + 1}`);

      this.events = this.events.slice(0, toIndex + 1);
      this.pendingUndo = null;

      // Broadcast full state (clients will recompute)
      this.broadcastFullState();
    } else {
      console.log(`[P2PRoom] Waiting for more approvals...`);
      this.broadcastState();
    }
  }

  /**
   * Deny pending undo request
   */
  denyUndo(): void {
    console.log(`[P2PRoom] Undo denied`);
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
    console.log(`[P2PRoom] ${this.isHost ? "Host" : "Client"} ending game: ${reason}`);

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
    this.room.leave();
  }

  /**
   * Broadcast full state to all peers (host only) - used for initial sync
   */
  private broadcastFullState(): void {
    if (!this.isHost) return;

    const state = this.getState();
    console.log(`[P2PRoom] Broadcasting full state: ${this.players.size} players, ${this.events.length} events`);
    this.sendFullState(state);
    this.notifyStateChange();
  }

  /**
   * Notify local state change handlers
   */
  private notifyStateChange(): void {
    const state = this.getState();
    for (const handler of this.stateHandlers) {
      handler(state);
    }
  }
}

/**
 * Generate a 6-character room code
 */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
