/**
 * useMultiplayerEngine - Hook that bridges DominionEngine with Martini Kit multiplayer
 *
 * This hook manages the game engine for multiplayer games:
 * - Host: Creates engine, validates commands, broadcasts events
 * - Client: Receives events, applies them locally
 */

import { useCallback, useRef, useEffect, useState } from "preact/hooks";
import { DominionEngine } from "../engine";
import type { GameState, CardName, PlayerId } from "../types/game-state";
import type { GameEvent, DecisionChoice } from "../events/types";
import type { CommandResult } from "../commands/types";
import { projectState } from "../events/project";

// Constants
const PLAYER_IDS: PlayerId[] = ["player0", "player1", "player2", "player3"];
const EVENT_OFFSET = 1;

// Player ID mapping - ensures type safety when converting index to Player
function getPlayerIdByIndex(index: number): PlayerId | null {
  return PLAYER_IDS[index] ?? null;
}

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
  myPlayerId: PlayerId | null;

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

// Helper: Setup engine subscription and initial events
function setupEngine(params: {
  engine: DominionEngine;
  isHost: boolean;
  onBroadcastEvents: (events: GameEvent[], newState: GameState) => void;
  setGameState: (state: GameState) => void;
  setEvents: (events: GameEvent[]) => void;
  initialEvents?: GameEvent[];
}): void {
  const {
    engine,
    isHost,
    onBroadcastEvents,
    setGameState,
    setEvents,
    initialEvents,
  } = params;

  engine.subscribe((newEvents: GameEvent[], state: GameState) => {
    setGameState(state);
    setEvents([...engine.eventLog]);

    if (isHost && newEvents.length > 0) {
      onBroadcastEvents(newEvents, state);
    }
  });

  if (initialEvents && initialEvents.length > 0) {
    engine.loadEvents(initialEvents);
  }
}

// Helper: Check if it's the player's turn
function checkIsMyTurn(
  gameState: GameState | null,
  myPlayerId: PlayerId | null,
): boolean {
  if (!gameState || !myPlayerId) {
    return false;
  }
  return gameState.activePlayer === myPlayerId && !gameState.pendingChoice;
}

// Helper: Find event index by ID
function findEventIndex(events: GameEvent[], eventId: string): number {
  return events.findIndex((e: GameEvent) => e.id === eventId);
}

// Helper: Execute command with player validation
type CommandExecutor = (
  commandFn: (playerId: PlayerId) => CommandResult,
) => CommandResult;

function createCommandExecutor(
  engine: DominionEngine | null,
  playerId: PlayerId | null,
): CommandResult | CommandExecutor {
  if (!engine || !playerId) {
    return { ok: false, error: "Not initialized" };
  }
  return (commandFn: (playerId: PlayerId) => CommandResult): CommandResult =>
    commandFn(playerId);
}

// Helper: Create basic action callbacks
function useBasicActions(
  engineRef: { readonly current: DominionEngine | null },
  myPlayerId: PlayerId | null,
): {
  playAction: (card: CardName) => CommandResult;
  playTreasure: (card: CardName) => CommandResult;
  playAllTreasures: () => CommandResult;
} {
  const playAction = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      const executor = createCommandExecutor(engine, myPlayerId);
      if ("ok" in executor) return executor;
      if (!engine) return { ok: false, error: "Engine not initialized" };
      return executor((playerId: PlayerId) =>
        engine.playAction(playerId, card),
      );
    },
    [engineRef, myPlayerId],
  );

  const playTreasure = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      const executor = createCommandExecutor(engine, myPlayerId);
      if ("ok" in executor) return executor;
      if (!engine) return { ok: false, error: "Engine not initialized" };
      return executor((playerId: PlayerId) =>
        engine.playTreasure(playerId, card),
      );
    },
    [engineRef, myPlayerId],
  );

  const playAllTreasures = useCallback((): CommandResult => {
    const engine = engineRef.current;
    const executor = createCommandExecutor(engine, myPlayerId);
    if ("ok" in executor) return executor;
    if (!engine) return { ok: false, error: "Engine not initialized" };
    return executor((playerId: PlayerId) => engine.playAllTreasures(playerId));
  }, [engineRef, myPlayerId]);

  return { playAction, playTreasure, playAllTreasures };
}

// Helper: Create buy and phase actions
function useBuyAndPhaseActions(
  engineRef: { readonly current: DominionEngine | null },
  myPlayerId: PlayerId | null,
): {
  buyCard: (card: CardName) => CommandResult;
  endPhase: () => CommandResult;
} {
  const buyCard = useCallback(
    (card: CardName): CommandResult => {
      const engine = engineRef.current;
      const executor = createCommandExecutor(engine, myPlayerId);
      if ("ok" in executor) return executor;
      if (!engine) return { ok: false, error: "Engine not initialized" };
      return executor((playerId: PlayerId) => engine.buyCard(playerId, card));
    },
    [engineRef, myPlayerId],
  );

  const endPhase = useCallback((): CommandResult => {
    const engine = engineRef.current;
    const executor = createCommandExecutor(engine, myPlayerId);
    if ("ok" in executor) return executor;
    if (!engine) return { ok: false, error: "Engine not initialized" };
    return executor((playerId: PlayerId) => engine.endPhase(playerId));
  }, [engineRef, myPlayerId]);

  return { buyCard, endPhase };
}

// Helper: Create decision action
function useDecisionAction(
  engineRef: { readonly current: DominionEngine | null },
  myPlayerId: PlayerId | null,
): {
  submitDecision: (choice: DecisionChoice) => CommandResult;
} {
  const submitDecision = useCallback(
    (choice: DecisionChoice): CommandResult => {
      const engine = engineRef.current;
      if (!engine || !myPlayerId) {
        return { ok: false, error: "Not initialized" };
      }
      const decisionPlayerId = engine.state.pendingChoice?.playerId;
      if (decisionPlayerId) {
        return engine.submitDecision(decisionplayerId, choice);
      }
      return { ok: false, error: "No pending decision" };
    },
    [myPlayerId, engineRef],
  );

  return { submitDecision };
}

// Helper: Create engine management hooks
function useEngineManagement(
  engineRef: { readonly current: DominionEngine | null },
  myPlayerId: PlayerId | null,
  events: GameEvent[],
  isHost: boolean,
): {
  startGame: (players: PlayerId[], kingdomCards?: CardName[]) => void;
  applyExternalEvents: (events: GameEvent[]) => void;
  resetToEvents: (events: GameEvent[]) => void;
  requestUndo: (toEventId: string, reason?: string) => void;
  getStateAtEvent: (eventId: string) => GameState;
} {
  const startGame = useCallback(
    (players: PlayerId[], kingdomCards?: CardName[]) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.startGame(players, kingdomCards);
    },
    [engineRef],
  );

  const applyExternalEvents = useCallback(
    (newEvents: GameEvent[]) => {
      const engine = engineRef.current;
      if (!engine || isHost) return;
      engine.applyExternalEvents(newEvents);
    },
    [isHost, engineRef],
  );

  const resetToEvents = useCallback(
    (newEvents: GameEvent[]) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.loadEvents(newEvents);
    },
    [engineRef],
  );

  const requestUndo = useCallback(
    (toEventId: string, reason?: string) => {
      const engine = engineRef.current;
      if (!engine || !myPlayerId) return;
      engine.requestUndo(myPlayerId, toEventId, reason);
    },
    [myPlayerId, engineRef],
  );

  const getStateAtEvent = useCallback(
    (eventId: string): GameState => {
      const eventIndex = findEventIndex(events, eventId);
      if (eventIndex === -1) {
        throw new Error(`Event ${eventId} not found`);
      }
      return projectState(events.slice(0, eventIndex + EVENT_OFFSET));
    },
    [events],
  );

  return {
    startGame,
    applyExternalEvents,
    resetToEvents,
    requestUndo,
    getStateAtEvent,
  };
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

  const myPlayerId: PlayerId | null =
    myPlayerIndex !== null ? getPlayerIdByIndex(myPlayerIndex) : null;

  const isMyTurn = checkIsMyTurn(gameState, myPlayerId);

  useEffect(() => {
    if (!engineRef.current) {
      const engine = new DominionEngine();
      engineRef.current = engine;
      setupEngine({
        engine,
        isHost,
        onBroadcastEvents,
        setGameState,
        setEvents,
        initialEvents,
      });
    }
  }, [isHost, onBroadcastEvents, initialEvents]);

  const basicActions = useBasicActions(engineRef, myPlayerId);
  const buyPhaseActions = useBuyAndPhaseActions(engineRef, myPlayerId);
  const decisionActions = useDecisionAction(engineRef, myPlayerId);
  const management = useEngineManagement(engineRef, myPlayerId, events, isHost);

  return {
    gameState,
    events,
    isMyTurn,
    myPlayerId,
    ...basicActions,
    ...buyPhaseActions,
    ...decisionActions,
    ...management,
  };
}
