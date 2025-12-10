import type { GameState, PlayerState } from "../types/game-state";
import type { GameEvent } from "./types";
import {
  applyTurnEvent,
  applyCardMovementEvent,
  applyResourceEvent,
  applyAttackAndReactionEvent,
  applyDecisionEvent,
  applyGameEndEvent,
} from "./apply-handlers";

// Helper to create the players record with proper typing
function createPlayersRecord(playerIds: string[]): Record<string, PlayerState> {
  return playerIds.reduce(
    (players, playerId) => ({
      ...players,
      [playerId]: {
        deck: [],
        hand: [],
        discard: [],
        inPlay: [],
        inPlaySourceIndices: [],
      },
    }),
    {} as Record<string, PlayerState>,
  );
}

/**
 * Apply game setup events
 */
function applyGameSetupEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "GAME_INITIALIZED") {
    const players = createPlayersRecord(event.players);
    return {
      ...state,
      players,
      supply: event.supply,
      kingdomCards: event.kingdomCards,
      playerOrder: event.players,
      turn: 0,
      phase: "action",
      activePlayer: event.players[0],
      actions: 1,
      buys: 1,
      coins: 0,
      gameOver: false,
      winner: null,
      pendingDecision: null,
      subPhase: null,
      trash: [],
      log: [],
      turnHistory: [],
      activeEffects: [],
    };
  }

  if (event.type === "INITIAL_DECK_DEALT") {
    const playerState = state.players[event.player];
    if (!playerState) return state;
    return {
      ...state,
      players: {
        ...state.players,
        [event.player]: {
          ...playerState,
          deck: [...event.cards],
        },
      },
    };
  }

  if (event.type === "INITIAL_HAND_DRAWN") {
    const playerState = state.players[event.player];
    if (!playerState) return state;
    const newDeck = playerState.deck.slice(0, -event.cards.length);
    return {
      ...state,
      players: {
        ...state.players,
        [event.player]: {
          ...playerState,
          deck: newDeck,
          hand: [...event.cards],
        },
      },
      turn: 1,
      log: [
        ...state.log,
        { type: "turn-start", turn: 1, player: state.activePlayer },
      ],
    };
  }

  return null;
}

/**
 * Apply a single event to game state, returning new state.
 * This is the core state transition function - pure and deterministic.
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
  // Try game setup events
  const setupResult = applyGameSetupEvent(state, event);
  if (setupResult) return setupResult;

  // Try turn events
  const turnResult = applyTurnEvent(state, event);
  if (turnResult) return turnResult;

  // Try card movement events
  const cardResult = applyCardMovementEvent(state, event);
  if (cardResult) return cardResult;

  // Try resource events
  const resourceResult = applyResourceEvent(state, event);
  if (resourceResult) return resourceResult;

  // Try attack and reaction events
  const attackResult = applyAttackAndReactionEvent(state, event);
  if (attackResult) return attackResult;

  // Try decision events
  const decisionResult = applyDecisionEvent(state, event);
  if (decisionResult) return decisionResult;

  // Try game end events
  const gameEndResult = applyGameEndEvent(state, event);
  if (gameEndResult) return gameEndResult;

  // Undo events don't modify state
  if (
    event.type === "UNDO_REQUESTED" ||
    event.type === "UNDO_APPROVED" ||
    event.type === "UNDO_DENIED" ||
    event.type === "UNDO_EXECUTED"
  ) {
    return state;
  }

  // Exhaustiveness check
  const _exhaustive: never = event;
  void _exhaustive;
  return state;
}

/**
 * Apply multiple events in sequence
 */
export function applyEvents(state: GameState, events: GameEvent[]): GameState {
  return events.reduce(applyEvent, state);
}
