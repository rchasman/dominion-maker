import type { GameState, PlayerState, LogEntry, CardName } from "../types/game-state";
import type {
  GameEvent,
} from "./types";

/**
 * Helper: Remove a card from a zone (hand, deck, discard) immutably.
 */
const removeCardFromZone = (zone: CardName[], card: CardName, fromDeck: boolean = false): CardName[] => {
  const idx = fromDeck ? zone.lastIndexOf(card) : zone.indexOf(card);
  return idx === -1 ? zone : [...zone.slice(0, idx), ...zone.slice(idx + 1)];
};

/**
 * Helper: Remove a card from inPlay zone along with its source index.
 */
const removeCardFromInPlay = (inPlay: CardName[], indices: number[], card: CardName): [CardName[], number[]] => {
  const idx = inPlay.indexOf(card);
  return idx === -1
    ? [inPlay, indices]
    : [
        [...inPlay.slice(0, idx), ...inPlay.slice(idx + 1)],
        [...indices.slice(0, idx), ...indices.slice(idx + 1)]
      ];
};

/**
 * Apply a single event to game state, returning new state.
 * This is the core state transition function - pure and deterministic.
 */
export function applyEvent(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    // ==================
    // GAME SETUP
    // ==================

    case "GAME_INITIALIZED": {
      const players = Object.fromEntries(
        event.players.map(playerId => [
          playerId,
          {
            deck: [],
            hand: [],
            discard: [],
            inPlay: [],
            inPlaySourceIndices: [],
          }
        ])
      ) as GameState["players"];

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
      };
    }

    case "INITIAL_DECK_DEALT": {
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

    case "INITIAL_HAND_DRAWN": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      // Move cards from deck to hand
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
        // Start turn 1 after all initial hands drawn
        turn: 1,
        log: [
          ...state.log,
          { type: "turn-start", turn: 1, player: state.activePlayer },
        ],
      };
    }

    // ==================
    // TURN STRUCTURE
    // ==================

    case "TURN_STARTED": {
      return {
        ...state,
        turn: event.turn,
        activePlayer: event.player,
        phase: "action",
        actions: 0, // Will be set by ACTIONS_MODIFIED event
        buys: 0, // Will be set by BUYS_MODIFIED event
        coins: 0,
        turnHistory: [],
        log: [
          ...state.log,
          { type: "turn-start", turn: event.turn, player: event.player },
        ],
      };
    }

    case "TURN_ENDED": {
      // Turn ended event doesn't change state, just serves as causal root
      return state;
    }

    case "PHASE_CHANGED": {
      return {
        ...state,
        phase: event.phase,
        log: [
          ...state.log,
          { type: "phase-change", player: state.activePlayer, phase: event.phase },
        ],
      };
    }

    // ==================
    // CARD MOVEMENTS
    // ==================

    case "CARD_DRAWN": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      // Remove from end of deck (top), add to hand
      const newDeck = playerState.deck.slice(0, -1);

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            deck: newDeck,
            hand: [...playerState.hand, event.card],
          },
        },
        log: [
          ...state.log,
          { type: "draw-cards", player: event.player, count: 1, cards: [event.card] },
        ],
      };
    }

    case "CARD_PLAYED": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      // Find and remove card from hand
      const handIndex = playerState.hand.indexOf(event.card);
      if (handIndex === -1) return state;

      const newHand = [...playerState.hand];
      newHand.splice(handIndex, 1);

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: newHand,
            inPlay: [...playerState.inPlay, event.card],
            inPlaySourceIndices: [...playerState.inPlaySourceIndices, handIndex],
          },
        },
      };
    }

    case "CARD_DISCARDED": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      const [newInPlay, newInPlaySourceIndices] = event.from === "inPlay"
        ? removeCardFromInPlay(playerState.inPlay, playerState.inPlaySourceIndices, event.card)
        : [playerState.inPlay, playerState.inPlaySourceIndices];

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: event.from === "hand" ? removeCardFromZone(playerState.hand, event.card) : playerState.hand,
            inPlay: newInPlay,
            inPlaySourceIndices: newInPlaySourceIndices,
            deck: event.from === "deck" ? removeCardFromZone(playerState.deck, event.card, true) : playerState.deck,
            discard: [...playerState.discard, event.card],
          },
        },
        log: [
          ...state.log,
          { type: "discard-cards", player: event.player, count: 1, cards: [event.card] },
        ],
      };
    }

    case "CARD_TRASHED": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      const [newInPlay, newInPlaySourceIndices] = event.from === "inPlay"
        ? removeCardFromInPlay(playerState.inPlay, playerState.inPlaySourceIndices, event.card)
        : [playerState.inPlay, playerState.inPlaySourceIndices];

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: event.from === "hand" ? removeCardFromZone(playerState.hand, event.card) : playerState.hand,
            deck: event.from === "deck" ? removeCardFromZone(playerState.deck, event.card, true) : playerState.deck,
            inPlay: newInPlay,
            inPlaySourceIndices: newInPlaySourceIndices,
          },
        },
        trash: [...state.trash, event.card],
        log: [
          ...state.log,
          { type: "trash-card", player: event.player, card: event.card },
        ],
      };
    }

    case "CARD_GAINED": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      // Decrement supply
      const newSupply = {
        ...state.supply,
        [event.card]: (state.supply[event.card] || 0) - 1,
      };

      // Add to destination zone
      let updates: Partial<PlayerState> = {};
      if (event.to === "hand") {
        updates = { hand: [...playerState.hand, event.card] };
      } else if (event.to === "discard") {
        updates = { discard: [...playerState.discard, event.card] };
      } else if (event.to === "deck") {
        // Top of deck = end of array
        updates = { deck: [...playerState.deck, event.card] };
      }

      // Track purchases in turnHistory (cards gained to discard are purchases)
      const newTurnHistory = event.to === "discard"
        ? [...state.turnHistory, { type: "buy_card" as const, card: event.card }]
        : state.turnHistory;

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            ...updates,
          },
        },
        supply: newSupply,
        turnHistory: newTurnHistory,
        log: [
          ...state.log,
          { type: "gain-card", player: event.player, card: event.card },
        ],
      };
    }

    case "CARD_REVEALED": {
      // Reveal doesn't change zones, just logs
      return {
        ...state,
        log: [
          ...state.log,
          { type: "text", message: `${event.player} reveals ${event.card}` },
        ],
      };
    }

    case "DECK_SHUFFLED": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      // Move discard into deck with new shuffled order
      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            deck: event.newDeckOrder,
            discard: [],
          },
        } as Record<string, typeof playerState>,
      };
    }

    case "CARD_PUT_ON_DECK": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: event.from === "hand" ? removeCardFromZone(playerState.hand, event.card) : playerState.hand,
            discard: event.from === "discard" ? removeCardFromZone(playerState.discard, event.card) : playerState.discard,
            deck: [...playerState.deck, event.card],
          },
        },
      };
    }

    case "CARD_RETURNED_TO_HAND": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      const [newInPlay, newInPlaySourceIndices] = event.from === "inPlay"
        ? removeCardFromInPlay(playerState.inPlay, playerState.inPlaySourceIndices, event.card)
        : [playerState.inPlay, playerState.inPlaySourceIndices];

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: [...playerState.hand, event.card],
            inPlay: newInPlay,
            inPlaySourceIndices: newInPlaySourceIndices,
            discard: event.from === "discard" ? removeCardFromZone(playerState.discard, event.card) : playerState.discard,
            deck: event.from === "deck" ? removeCardFromZone(playerState.deck, event.card, true) : playerState.deck,
          },
        },
      };
    }

    // ==================
    // RESOURCES
    // ==================

    case "ACTIONS_MODIFIED": {
      const newActions = Math.max(0, state.actions + event.delta);
      const logEntry: LogEntry | null = event.delta > 0
        ? { type: "get-actions", player: state.activePlayer, count: event.delta }
        : null;

      return {
        ...state,
        actions: newActions,
        log: logEntry ? [...state.log, logEntry] : state.log,
      };
    }

    case "BUYS_MODIFIED": {
      const newBuys = Math.max(0, state.buys + event.delta);
      const logEntry: LogEntry | null = event.delta > 0
        ? { type: "get-buys", player: state.activePlayer, count: event.delta }
        : null;

      return {
        ...state,
        buys: newBuys,
        log: logEntry ? [...state.log, logEntry] : state.log,
      };
    }

    case "COINS_MODIFIED": {
      const newCoins = Math.max(0, state.coins + event.delta);
      const logEntry: LogEntry | null = event.delta > 0
        ? { type: "get-coins", player: state.activePlayer, count: event.delta }
        : null;

      return {
        ...state,
        coins: newCoins,
        log: logEntry ? [...state.log, logEntry] : state.log,
      };
    }

    // ==================
    // DECISIONS
    // ==================

    case "DECISION_REQUIRED": {
      const decision = event.decision;
      return {
        ...state,
        subPhase: decision.player !== state.activePlayer ? "opponent_decision" : null,
        pendingDecision: decision,
      };
    }

    case "DECISION_RESOLVED": {
      return {
        ...state,
        pendingDecision: null,
        subPhase: null,
      };
    }

    // ==================
    // GAME END
    // ==================

    case "GAME_ENDED": {
      return {
        ...state,
        gameOver: true,
        winner: event.winner,
        log: [
          ...state.log,
          {
            type: "game-over",
            humanVP: event.scores["human"] || event.scores["player0"] || 0,
            aiVP: event.scores["ai"] || event.scores["player1"] || 0,
            winner: event.winner || "human",
          },
        ],
      };
    }

    // ==================
    // UNDO (handled specially by engine)
    // ==================

    case "UNDO_REQUESTED":
    case "UNDO_APPROVED":
    case "UNDO_DENIED":
    case "UNDO_EXECUTED":
      // These are meta-events handled by the engine, not applied to game state
      return state;

    default: {
      // Exhaustiveness check
      const _exhaustive: never = event;
      void _exhaustive;
      return state;
    }
  }
}

/**
 * Apply multiple events in sequence
 */
export function applyEvents(state: GameState, events: GameEvent[]): GameState {
  return events.reduce(applyEvent, state);
}

