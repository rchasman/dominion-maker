/**
 * useMultiplayerEngine - Hook that bridges DominionEngine with Martini Kit multiplayer
 *
 * This hook manages the game engine for multiplayer games:
 * - Host: Creates engine, validates commands, broadcasts events
 * - Client: Receives events, applies them locally
 */

import { useCallback, useRef, useEffect, useState } from "react";
import { DominionEngine } from "../engine";
import type { GameState, CardName, Player } from "../types/game-state";
import type { GameEvent, DecisionChoice, PlayerId } from "../events/types";
import type { CommandResult } from "../commands/types";
import { projectState } from "../events/project";

interface UseMultiplayerEngineOptions {
  /** Whether this client is the host */
  isHost: boolean;
  /** My player index (0, 1, 2, 3) */
  myPlayerIndex: number | null;
  /** Callback to broadcast events to other players (via Martini Kit) */
  onBroadcastEvents: (events: GameEvent[], newState: GameState) => void;
  /** Initial events (when joining an in-progress game) */
  initialEvents?: GameEvent[];
}

interface UseMultiplayerEngineReturn {
  /** Current game state */
  gameState: GameState | null;

  /** Full event log */
  events: GameEvent[];

  /** Whether it's this player's turn */
  isMyTurn: boolean;

  /** My player ID (player0, player1, etc.) */
  myPlayerId: Player | null;

  // Game actions (these validate locally, then broadcast if host, or send command if client)
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
  submitDecision: (choice: DecisionChoice) => CommandResult;

  // Undo actions
  requestUndo: (toEventId: string, reason?: string) => void;
  getStateAtEvent: (eventId: string) => GameState;

  // Engine management
  startGame: (players: PlayerId[], kingdomCards?: CardName[]) => void;
  applyExternalEvents: (events: GameEvent[]) => void;
  resetToEvents: (events: GameEvent[]) => void;
}

export function useMultiplayerEngine({
  isHost,
  myPlayerIndex,
  onBroadcastEvents,
  initialEvents,
}: UseMultiplayerEngineOptions): UseMultiplayerEngineReturn {
  const engineRef = useRef<DominionEngine | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);

  // Compute my player ID
  const myPlayerId: Player | null = myPlayerIndex !== null
    ? (`player${myPlayerIndex}` as Player)
    : null;

  // Check if it's my turn
  const isMyTurn = gameState?.activePlayer === myPlayerId && !gameState?.pendingDecision;

  // Initialize engine
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new DominionEngine();

      // Subscribe to state changes
      engineRef.current.subscribe((newEvents, state) => {
        setGameState(state);
        setEvents([...engineRef.current!.eventLog]);

        // If host, broadcast events
        if (isHost && newEvents.length > 0) {
          onBroadcastEvents(newEvents, state);
        }
      });

      // Load initial events if provided
      if (initialEvents && initialEvents.length > 0) {
        engineRef.current.loadEvents(initialEvents);
      }
    }
  }, [isHost, onBroadcastEvents, initialEvents]);

  // Start a new game
  const startGame = useCallback((players: PlayerId[], kingdomCards?: CardName[]) => {
    if (!engineRef.current) return;
    engineRef.current.startGame(players, kingdomCards);
  }, []);

  // Apply events from external source (for clients)
  const applyExternalEvents = useCallback((newEvents: GameEvent[]) => {
    if (!engineRef.current || isHost) return;
    engineRef.current.applyExternalEvents(newEvents);
  }, [isHost]);

  // Reset to a specific event log (for undo)
  const resetToEvents = useCallback((newEvents: GameEvent[]) => {
    if (!engineRef.current) return;
    engineRef.current.loadEvents(newEvents);
  }, []);

  // Helper to execute a command
  const executeCommand = useCallback((
    commandFn: (player: PlayerId) => CommandResult
  ): CommandResult => {
    if (!engineRef.current || !myPlayerId) {
      return { ok: false, error: "Not initialized" };
    }
    return commandFn(myPlayerId);
  }, [myPlayerId]);

  // Game actions
  const playAction = useCallback((card: CardName): CommandResult => {
    return executeCommand((player) => engineRef.current!.playAction(player, card));
  }, [executeCommand]);

  const playTreasure = useCallback((card: CardName): CommandResult => {
    return executeCommand((player) => engineRef.current!.playTreasure(player, card));
  }, [executeCommand]);

  const playAllTreasures = useCallback((): CommandResult => {
    return executeCommand((player) => engineRef.current!.playAllTreasures(player));
  }, [executeCommand]);

  const buyCard = useCallback((card: CardName): CommandResult => {
    return executeCommand((player) => engineRef.current!.buyCard(player, card));
  }, [executeCommand]);

  const endPhase = useCallback((): CommandResult => {
    return executeCommand((player) => engineRef.current!.endPhase(player));
  }, [executeCommand]);

  const submitDecision = useCallback((choice: DecisionChoice): CommandResult => {
    if (!engineRef.current || !myPlayerId) {
      return { ok: false, error: "Not initialized" };
    }
    // Decision might be for a different player (opponent's response to attack)
    const decisionPlayer = engineRef.current.state.pendingDecision?.player;
    if (decisionPlayer) {
      return engineRef.current.submitDecision(decisionPlayer, choice);
    }
    return { ok: false, error: "No pending decision" };
  }, [myPlayerId]);

  // Undo
  const requestUndo = useCallback((toEventId: string, reason?: string) => {
    if (!engineRef.current || !myPlayerId) return;
    engineRef.current.requestUndo(myPlayerId, toEventId, reason);
  }, [myPlayerId]);

  const getStateAtEvent = useCallback((eventId: string): GameState => {
    const eventIndex = events.findIndex(e => e.id === eventId);
    if (eventIndex === -1) {
      throw new Error(`Event ${eventId} not found`);
    }
    return projectState(events.slice(0, eventIndex + 1));
  }, [events]);

  return {
    gameState,
    events,
    isMyTurn,
    myPlayerId,
    playAction,
    playTreasure,
    playAllTreasures,
    buyCard,
    endPhase,
    submitDecision,
    requestUndo,
    getStateAtEvent,
    startGame,
    applyExternalEvents,
    resetToEvents,
  };
}
