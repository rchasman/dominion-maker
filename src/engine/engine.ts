import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, PlayerId, DecisionChoice } from "../events/types";
import type { GameCommand, CommandResult } from "../commands/types";
import { handleCommand } from "../commands/handle";
import { projectState, createEmptyState } from "../events/project";
import { removeEventChain } from "../events/types";
import { generateEventId } from "../events/id-generator";
import { engineLogger } from "../lib/logger";
import { isActionCard } from "../data/cards";

/**
 * Pending undo request awaiting approval.
 */
export type PendingUndoRequest = {
  requestId: string;
  byPlayer: PlayerId;
  toEventId: string; // Changed from toEventIndex to toEventId
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
  private cachedState: GameState | null = null;
  private listeners: Set<EventListener> = new Set();
  private pendingUndo: PendingUndoRequest | null = null;

  // Unique game ID for devtools grouping (uses first event ID)
  get gameId(): string | undefined {
    return this.events[0]?.id;
  }

  /**
   * Get current game state (cached, invalidated on new events).
   */
  get state(): GameState {
    if (!this.cachedState) {
      this.cachedState =
        this.events.length > 0 ? projectState(this.events) : createEmptyState();
    }
    return this.cachedState;
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
  startGame(
    players: PlayerId[],
    kingdomCards?: CardName[],
    seed?: number,
  ): CommandResult {
    // Clear existing state
    this.events = [];
    this.cachedState = null;
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
   * Skip the current decision.
   */
  skipDecision(player: PlayerId): CommandResult {
    return this.dispatch({ type: "SKIP_DECISION", player }, player);
  }

  /**
   * Request to undo to a specific event ID (causal root).
   */
  requestUndo(
    player: PlayerId,
    toEventId: string,
    reason?: string,
  ): CommandResult {
    const result = this.dispatch(
      {
        type: "REQUEST_UNDO",
        player,
        toEventId,
        reason,
      },
      player,
    );

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
          toEventId,
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
   * Immediate undo to event (single-player, no approval needed).
   * Removes the event and its causal chain.
   */
  undoToEvent(toEventId: string): void {
    engineLogger.info(`Undo to ${toEventId}`);
    this.events = removeEventChain(toEventId, this.events);
    this.cachedState = null; // Invalidate cached state
    this.notifyListeners(this.events);
  }

  /**
   * Get state at a specific event ID (for time travel preview).
   */
  getStateAtEvent(eventId: string): GameState {
    const eventIndex = this.events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      throw new Error(`Event ${eventId} not found`);
    }
    return projectState(this.events.slice(0, eventIndex + 1));
  }

  /**
   * Fork the engine for hypothetical exploration (e.g., LLM voting).
   */
  fork(): DominionEngine {
    const forked = new DominionEngine();
    forked.events = [...this.events];
    forked.cachedState = null; // Will be recomputed on access
    return forked;
  }

  /**
   * Check if a player should auto-advance from action to buy phase.
   * Returns true when player has no playable actions (no action cards OR no actions remaining).
   */
  shouldAutoAdvancePhase(playerId: PlayerId): boolean {
    const state = this.state;

    // Only auto-advance in action phase
    if (state.phase !== "action") return false;

    // Don't auto-advance if it's not the player's turn
    if (state.activePlayer !== playerId) return false;

    // Don't auto-advance during decisions
    if (state.pendingDecision) return false;

    // Don't auto-advance if game is over
    if (state.gameOver) return false;

    const player = state.players[playerId];
    if (!player) return false;

    // Check if player can play any actions
    const hasActionCards = player.hand.some(card => isActionCard(card));
    const hasActions = state.actions > 0;

    // Auto-advance if no actions available OR no action cards to play
    return !hasActions || !hasActionCards;
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
    engine.events = JSON.parse(json) as GameEvent[];
    engine.cachedState = null;
    return engine;
  }

  /**
   * Load events (e.g., from network).
   */
  loadEvents(events: GameEvent[]): void {
    this.events = [...events];
    this.cachedState = null;
    this.notifyListeners(events);
  }

  /**
   * Load events silently without notifying listeners (for undo).
   */
  loadEventsSilently(events: GameEvent[]): void {
    this.events = [...events];
    this.cachedState = null;
  }

  /**
   * Apply events from external source (e.g., network).
   */
  applyExternalEvents(events: GameEvent[]): void {
    // Add IDs to events that don't have them
    const eventsWithIds: GameEvent[] = events.map(event =>
      event.id ? event : { ...event, id: generateEventId() },
    );
    this.events = [...this.events, ...eventsWithIds];
    this.cachedState = null;
    this.notifyListeners(eventsWithIds);
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
    // Add IDs to events that don't have them
    const eventsWithIds: GameEvent[] = events.map(event =>
      event.id ? event : { ...event, id: generateEventId() },
    );
    this.events = [...this.events, ...eventsWithIds];
    this.cachedState = null;
    this.notifyListeners(eventsWithIds);
  }

  private notifyListeners(events: GameEvent[]): void {
    const state = this.state;
    [...this.listeners].map(listener => listener(events, state));
  }

  private handleUndoResponse({
    type,
    player: playerId,
    requestId,
  }: {
    type: "APPROVE_UNDO" | "DENY_UNDO";
    player: PlayerId;
    requestId: string;
  }): CommandResult {
    if (!this.pendingUndo) {
      return { ok: false, error: "No pending undo request" };
    }

    if (this.pendingUndo.requestId !== requestId) {
      return { ok: false, error: "Request ID mismatch" };
    }

    if (type === "DENY_UNDO") {
      const events: GameEvent[] = [
        {
          type: "UNDO_DENIED",
          requestId,
          byPlayer: playerId,
          id: generateEventId(),
        },
      ];
      this.pendingUndo = null;
      this.appendEvents(events);
      return { ok: true, events };
    }

    // APPROVE_UNDO
    this.pendingUndo.approvals.add(playerId);
    const approvalEvent: GameEvent = {
      type: "UNDO_APPROVED",
      requestId,
      byPlayer: playerId,
      id: generateEventId(),
    };

    // Check if we have enough approvals
    if (this.pendingUndo.approvals.size >= this.pendingUndo.needed) {
      // Execute the undo using causal chain removal
      const toEventId = this.pendingUndo.toEventId;

      // Find the target event
      const targetEvent = this.events.find(e => e.id === toEventId);
      if (!targetEvent) {
        return { ok: false, error: "Target event not found" };
      }

      // Get the ID of the last event before removal
      const lastEvent = this.events[this.events.length - 1];
      const fromEventId = lastEvent?.id || "";

      // Record undo execution
      const undoExecutedEvent: GameEvent = {
        type: "UNDO_EXECUTED",
        fromEventId,
        toEventId,
        id: generateEventId(),
      };

      const events: GameEvent[] = [approvalEvent, undoExecutedEvent];

      // Remove the target event and all events caused by it (atomically)
      this.events = removeEventChain(toEventId, this.events);
      this.cachedState = null;
      this.pendingUndo = null;

      // Add the undo execution event to the log
      this.appendEvents(events);
      return { ok: true, events };
    }

    const events: GameEvent[] = [approvalEvent];
    this.appendEvents(events);
    return { ok: true, events };
  }
}

/**
 * Create and start a new game engine.
 */
export function createGame(
  players: PlayerId[],
  kingdomCards?: CardName[],
  seed?: number,
): DominionEngine {
  const engine = new DominionEngine();
  engine.startGame(players, kingdomCards, seed);
  return engine;
}
