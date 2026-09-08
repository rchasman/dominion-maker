import type { GameState, CardName } from "../types/game-state";
import type { GameEvent, PlayerId, DecisionChoice } from "../events/types";
import type { GameCommand, CommandResult } from "../commands/types";
import { handleCommand } from "../commands/handle";
import { projectState, createEmptyState } from "../events/project";
import { removeEventChain } from "../events/types";
import { generateEventId } from "../events/id-generator";
import { engineLogger } from "../lib/logger";
import { isActionCard } from "../data/cards";
import { applyEvents } from "../events/apply";
import { buildLogFromEvents } from "../events/log-builder";

import { projectUndoRequest, respondToUndo } from "./undo-session";
import type { PendingUndoRequest } from "./undo-session";
export type { PendingUndoRequest } from "./undo-session";

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
    return projectUndoRequest(this.events, this.state.playerOrder);
  }

  /**
   * Dispatch a command. Validates and emits events.
   */
  dispatch(command: GameCommand, fromPlayer?: PlayerId): CommandResult {
    if (fromPlayer && "playerId" in command && command.playerId !== fromPlayer)
      return { ok: false, error: "Player identity mismatch" };
    if (command.type === "REQUEST_UNDO" && this.undoRequest)
      return { ok: false, error: "An undo request is already pending" };
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

    return this.dispatch({
      type: "START_GAME",
      players,
      ...(kingdomCards !== undefined && { kingdomCards }),
      ...(seed !== undefined && { seed }),
    });
  }

  /**
   * Play an action card.
   */
  playAction(playerId: PlayerId, card: CardName): CommandResult {
    return this.dispatch({ type: "PLAY_ACTION", playerId, card }, playerId);
  }

  /**
   * Play a treasure card.
   */
  playTreasure(playerId: PlayerId, card: CardName): CommandResult {
    return this.dispatch({ type: "PLAY_TREASURE", playerId, card }, playerId);
  }

  /**
   * Play all treasures in hand.
   */
  playAllTreasures(playerId: PlayerId): CommandResult {
    return this.dispatch({ type: "PLAY_ALL_TREASURES", playerId }, playerId);
  }

  /**
   * Buy a card.
   */
  buyCard(playerId: PlayerId, card: CardName): CommandResult {
    return this.dispatch({ type: "BUY_CARD", playerId, card }, playerId);
  }

  /**
   * End the current phase.
   */
  endPhase(playerId: PlayerId): CommandResult {
    return this.dispatch({ type: "END_PHASE", playerId }, playerId);
  }

  /**
   * Submit a decision response.
   */
  submitDecision(playerId: PlayerId, choice: DecisionChoice): CommandResult {
    return this.dispatch(
      { type: "SUBMIT_DECISION", playerId, choice },
      playerId,
    );
  }

  /**
   * Skip the current decision.
   */
  skipDecision(playerId: PlayerId): CommandResult {
    return this.dispatch({ type: "SKIP_DECISION", playerId }, playerId);
  }

  /**
   * Request to undo to a specific event ID (causal root).
   */
  requestUndo(
    playerId: PlayerId,
    toEventId: string,
    reason?: string,
  ): CommandResult {
    return this.dispatch(
      {
        type: "REQUEST_UNDO",
        playerId,
        toEventId,
        ...(reason !== undefined && { reason }),
      },
      playerId,
    );
  }

  /**
   * Approve an undo request.
   */
  approveUndo(playerId: PlayerId, requestId: string): CommandResult {
    return this.handleUndoResponse({
      type: "APPROVE_UNDO",
      playerId,
      requestId,
    });
  }

  /**
   * Deny an undo request.
   */
  denyUndo(playerId: PlayerId, requestId: string): CommandResult {
    return this.handleUndoResponse({ type: "DENY_UNDO", playerId, requestId });
  }

  /**
   * Immediate undo to event (single-playerId, no approval needed).
   * Keeps the event and its completed causal effects, then truncates later history.
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
    forked.cachedState = structuredClone(this.state);
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
    if (state.activePlayerId !== playerId) return false;

    // Don't auto-advance during decisions
    if (state.pendingChoice) return false;

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
    this.appendEvents(events);
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
    const nextState = applyEvents(this.state, eventsWithIds);
    this.events = [...this.events, ...eventsWithIds];
    this.cachedState = { ...nextState, log: buildLogFromEvents(this.events) };
    this.notifyListeners(eventsWithIds);
  }

  private notifyListeners(events: GameEvent[]): void {
    const state = this.state;
    [...this.listeners].map(listener => listener(events, state));
  }

  private handleUndoResponse(command: {
    type: "APPROVE_UNDO" | "DENY_UNDO";
    playerId: PlayerId;
    requestId: string;
  }): CommandResult {
    const result = respondToUndo(
      this.undoRequest,
      command,
      this.state.playerOrder,
      this.events,
    );
    if (!result.ok) return result;
    const rewind = result.events.find(event => event.type === "UNDO_EXECUTED");
    if (rewind) {
      this.events = removeEventChain(rewind.toEventId, this.events);
      this.cachedState = null;
    }
    this.appendEvents(result.events);
    return result;
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
