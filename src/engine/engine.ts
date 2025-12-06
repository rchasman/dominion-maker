import type { GameState, Player, CardName } from "../types/game-state";
import type { GameEvent, PlayerId, DecisionChoice } from "../events/types";
import type { GameCommand, CommandResult } from "../commands/types";
import { handleCommand } from "../commands/handle";
import { applyEvents } from "../events/apply";
import { projectState, projectStateAt, createEmptyState } from "../events/project";

/**
 * Pending undo request awaiting approval.
 */
export type PendingUndoRequest = {
  requestId: string;
  byPlayer: PlayerId;
  toEventIndex: number;
  reason?: string;
  approvals: Set<PlayerId>;
  needed: number;
};

/**
 * Event listener callback type.
 */
export type EventListener = (events: GameEvent[], state: GameState) => void;

/**
 * DominionEngine - Event-sourced game engine.
 *
 * This is the core game engine that:
 * - Stores events as source of truth
 * - Derives state by projecting events
 * - Validates and executes commands
 * - Supports undo/redo via event manipulation
 * - Broadcasts events to listeners (for multiplayer)
 */
export class DominionEngine {
  private events: GameEvent[] = [];
  private _state: GameState | null = null;
  private listeners: Set<EventListener> = new Set();
  private pendingUndo: PendingUndoRequest | null = null;

  /**
   * Get current game state (cached, invalidated on new events).
   */
  get state(): GameState {
    if (!this._state) {
      this._state = this.events.length > 0
        ? projectState(this.events)
        : createEmptyState();
    }
    return this._state;
  }

  /**
   * Get the full event log.
   */
  get eventLog(): readonly GameEvent[] {
    return this.events;
  }

  /**
   * Get pending undo request, if any.
   */
  get undoRequest(): PendingUndoRequest | null {
    return this.pendingUndo;
  }

  /**
   * Dispatch a command. Validates and emits events.
   */
  dispatch(command: GameCommand, fromPlayer?: PlayerId): CommandResult {
    // Handle undo approval/denial specially
    if (command.type === "APPROVE_UNDO" || command.type === "DENY_UNDO") {
      return this.handleUndoResponse(command);
    }

    const result = handleCommand(this.state, command, fromPlayer);

    if (result.ok) {
      this.appendEvents(result.events);
    }

    return result;
  }

  /**
   * Start a new game.
   */
  startGame(players: PlayerId[], kingdomCards?: CardName[], seed?: number): CommandResult {
    // Clear existing state
    this.events = [];
    this._state = null;
    this.pendingUndo = null;

    return this.dispatch({
      type: "START_GAME",
      players,
      kingdomCards,
      seed,
    });
  }

  /**
   * Play an action card.
   */
  playAction(player: PlayerId, card: CardName): CommandResult {
    return this.dispatch({ type: "PLAY_ACTION", player, card }, player);
  }

  /**
   * Play a treasure card.
   */
  playTreasure(player: PlayerId, card: CardName): CommandResult {
    return this.dispatch({ type: "PLAY_TREASURE", player, card }, player);
  }

  /**
   * Play all treasures in hand.
   */
  playAllTreasures(player: PlayerId): CommandResult {
    return this.dispatch({ type: "PLAY_ALL_TREASURES", player }, player);
  }

  /**
   * Buy a card.
   */
  buyCard(player: PlayerId, card: CardName): CommandResult {
    return this.dispatch({ type: "BUY_CARD", player, card }, player);
  }

  /**
   * End the current phase.
   */
  endPhase(player: PlayerId): CommandResult {
    return this.dispatch({ type: "END_PHASE", player }, player);
  }

  /**
   * Submit a decision response.
   */
  submitDecision(player: PlayerId, choice: DecisionChoice): CommandResult {
    return this.dispatch({ type: "SUBMIT_DECISION", player, choice }, player);
  }

  /**
   * Request to undo to a specific event index.
   */
  requestUndo(player: PlayerId, toEventIndex: number, reason?: string): CommandResult {
    const result = this.dispatch({
      type: "REQUEST_UNDO",
      player,
      toEventIndex,
      reason,
    }, player);

    if (result.ok) {
      // Find the request event we just added
      const requestEvent = result.events.find(e => e.type === "UNDO_REQUESTED");
      if (requestEvent && requestEvent.type === "UNDO_REQUESTED") {
        // Set up pending undo request
        const playerOrder = this.state.playerOrder || ["human", "ai"];
        const opponents = playerOrder.filter(p => p !== player);

        this.pendingUndo = {
          requestId: requestEvent.requestId,
          byPlayer: player,
          toEventIndex,
          reason,
          approvals: new Set(),
          needed: opponents.length, // All opponents must approve
        };
      }
    }

    return result;
  }

  /**
   * Approve an undo request.
   */
  approveUndo(player: PlayerId, requestId: string): CommandResult {
    return this.handleUndoResponse({ type: "APPROVE_UNDO", player, requestId });
  }

  /**
   * Deny an undo request.
   */
  denyUndo(player: PlayerId, requestId: string): CommandResult {
    return this.handleUndoResponse({ type: "DENY_UNDO", player, requestId });
  }

  /**
   * Get state at a specific event index (for time travel preview).
   */
  getStateAt(eventIndex: number): GameState {
    return projectStateAt(this.events, eventIndex);
  }

  /**
   * Fork the engine for hypothetical exploration (e.g., LLM voting).
   */
  fork(): DominionEngine {
    const forked = new DominionEngine();
    forked.events = [...this.events];
    forked._state = null; // Will be recomputed on access
    return forked;
  }

  /**
   * Serialize the event log.
   */
  serialize(): string {
    return JSON.stringify(this.events);
  }

  /**
   * Load from serialized event log.
   */
  static deserialize(json: string): DominionEngine {
    const engine = new DominionEngine();
    engine.events = JSON.parse(json);
    engine._state = null;
    return engine;
  }

  /**
   * Load events (e.g., from network).
   */
  loadEvents(events: GameEvent[]): void {
    this.events = [...events];
    this._state = null;
    this.notifyListeners(events);
  }

  /**
   * Apply events from external source (e.g., network).
   */
  applyExternalEvents(events: GameEvent[]): void {
    this.events.push(...events);
    this._state = null;
    this.notifyListeners(events);
  }

  /**
   * Subscribe to event broadcasts.
   */
  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ============================================
  // PRIVATE
  // ============================================

  private appendEvents(events: GameEvent[]): void {
    this.events.push(...events);
    this._state = null;
    this.notifyListeners(events);
  }

  private notifyListeners(events: GameEvent[]): void {
    const state = this.state;
    for (const listener of this.listeners) {
      listener(events, state);
    }
  }

  private handleUndoResponse(
    command: { type: "APPROVE_UNDO" | "DENY_UNDO"; player: PlayerId; requestId: string }
  ): CommandResult {
    if (!this.pendingUndo) {
      return { ok: false, error: "No pending undo request" };
    }

    if (this.pendingUndo.requestId !== command.requestId) {
      return { ok: false, error: "Request ID mismatch" };
    }

    const events: GameEvent[] = [];

    if (command.type === "DENY_UNDO") {
      events.push({
        type: "UNDO_DENIED",
        requestId: command.requestId,
        byPlayer: command.player as Player,
      });
      this.pendingUndo = null;
      this.appendEvents(events);
      return { ok: true, events };
    }

    // APPROVE_UNDO
    this.pendingUndo.approvals.add(command.player);
    events.push({
      type: "UNDO_APPROVED",
      requestId: command.requestId,
      byPlayer: command.player as Player,
    });

    // Check if we have enough approvals
    if (this.pendingUndo.approvals.size >= this.pendingUndo.needed) {
      // Execute the undo
      const toIndex = this.pendingUndo.toEventIndex;
      const fromIndex = this.events.length;

      // Record undo execution
      events.push({
        type: "UNDO_EXECUTED",
        fromEventIndex: fromIndex,
        toEventIndex: toIndex,
      });

      // Truncate event log
      this.events = this.events.slice(0, toIndex + 1);
      this._state = null;
      this.pendingUndo = null;

      // Add the events we collected to the (now truncated) log
      this.appendEvents(events);
    } else {
      this.appendEvents(events);
    }

    return { ok: true, events };
  }
}

/**
 * Create and start a new game engine.
 */
export function createGame(
  players: PlayerId[],
  kingdomCards?: CardName[],
  seed?: number
): DominionEngine {
  const engine = new DominionEngine();
  engine.startGame(players, kingdomCards, seed);
  return engine;
}
