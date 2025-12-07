import type { GameState, PlayerState, Player, CardName, LogEntry } from "../types/game-state";
import type {
  GameEvent,
  DecisionRequest,
} from "./types";

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
      const players: Record<string, PlayerState> = {};
      for (const playerId of event.players) {
        players[playerId] = {
          deck: [],
          hand: [],
          discard: [],
          inPlay: [],
          inPlaySourceIndices: [],
        };
      }

      return {
        ...state,
        players: players as GameState["players"],
        supply: event.supply,
        kingdomCards: event.kingdomCards,
        playerOrder: event.players as Player[],
        turn: 0,
        phase: "action",
        activePlayer: event.players[0] as Player,
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

    case "CARDS_DRAWN": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      // Remove from end of deck (top), add to hand
      const newDeck = playerState.deck.slice(0, -event.cards.length);

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            deck: newDeck,
            hand: [...playerState.hand, ...event.cards],
          },
        },
        log: [
          ...state.log,
          { type: "draw-cards", player: event.player, count: event.cards.length, cards: event.cards },
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

    case "CARDS_DISCARDED": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      let newHand = [...playerState.hand];
      let newInPlay = [...playerState.inPlay];
      let newDeck = [...playerState.deck];
      let newInPlaySourceIndices = [...playerState.inPlaySourceIndices];

      // Remove cards from source zone
      for (const card of event.cards) {
        if (event.from === "hand") {
          const idx = newHand.indexOf(card);
          if (idx !== -1) newHand.splice(idx, 1);
        } else if (event.from === "inPlay") {
          const idx = newInPlay.indexOf(card);
          if (idx !== -1) {
            newInPlay.splice(idx, 1);
            newInPlaySourceIndices.splice(idx, 1);
          }
        } else if (event.from === "deck") {
          // Remove from top of deck (end of array)
          const idx = newDeck.lastIndexOf(card);
          if (idx !== -1) newDeck.splice(idx, 1);
        }
      }

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: newHand,
            inPlay: newInPlay,
            inPlaySourceIndices: newInPlaySourceIndices,
            deck: newDeck,
            discard: [...playerState.discard, ...event.cards],
          },
        },
        log: [
          ...state.log,
          { type: "discard-cards", player: event.player, count: event.cards.length, cards: event.cards },
        ],
      };
    }

    case "CARDS_TRASHED": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      let newHand = [...playerState.hand];
      let newDeck = [...playerState.deck];
      let newInPlay = [...playerState.inPlay];
      let newInPlaySourceIndices = [...playerState.inPlaySourceIndices];

      // Remove cards from source zone
      for (const card of event.cards) {
        if (event.from === "hand") {
          const idx = newHand.indexOf(card);
          if (idx !== -1) newHand.splice(idx, 1);
        } else if (event.from === "deck") {
          const idx = newDeck.lastIndexOf(card);
          if (idx !== -1) newDeck.splice(idx, 1);
        } else if (event.from === "inPlay") {
          const idx = newInPlay.indexOf(card);
          if (idx !== -1) {
            newInPlay.splice(idx, 1);
            newInPlaySourceIndices.splice(idx, 1);
          }
        }
      }

      // Add log entries for each trashed card
      const trashLogs: LogEntry[] = event.cards.map(card => ({
        type: "trash-card" as const,
        player: event.player,
        card,
      }));

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: newHand,
            deck: newDeck,
            inPlay: newInPlay,
            inPlaySourceIndices: newInPlaySourceIndices,
          },
        },
        trash: [...state.trash, ...event.cards],
        log: [...state.log, ...trashLogs],
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
        log: [
          ...state.log,
          { type: "gain-card", player: event.player, card: event.card },
        ],
      };
    }

    case "CARDS_REVEALED": {
      // Reveal doesn't change zones, just logs
      return {
        ...state,
        log: [
          ...state.log,
          { type: "text", message: `${event.player} reveals ${event.cards.join(", ")}` },
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
        },
      };
    }

    case "CARDS_PUT_ON_DECK": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      let newHand = [...playerState.hand];
      let newDiscard = [...playerState.discard];

      // Remove from source
      for (const card of event.cards) {
        if (event.from === "hand") {
          const idx = newHand.indexOf(card);
          if (idx !== -1) newHand.splice(idx, 1);
        } else if (event.from === "discard") {
          const idx = newDiscard.indexOf(card);
          if (idx !== -1) newDiscard.splice(idx, 1);
        }
      }

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: newHand,
            discard: newDiscard,
            // Add to top of deck (end of array)
            deck: [...playerState.deck, ...event.cards],
          },
        },
      };
    }

    case "CARD_RETURNED_TO_HAND": {
      const playerState = state.players[event.player];
      if (!playerState) return state;

      let newInPlay = [...playerState.inPlay];
      let newInPlaySourceIndices = [...playerState.inPlaySourceIndices];
      let newDiscard = [...playerState.discard];
      let newDeck = [...playerState.deck];

      // Remove from source zone
      if (event.from === "inPlay") {
        const idx = newInPlay.indexOf(event.card);
        if (idx !== -1) {
          newInPlay.splice(idx, 1);
          newInPlaySourceIndices.splice(idx, 1);
        }
      } else if (event.from === "discard") {
        const idx = newDiscard.indexOf(event.card);
        if (idx !== -1) newDiscard.splice(idx, 1);
      } else if (event.from === "deck") {
        const idx = newDeck.lastIndexOf(event.card);
        if (idx !== -1) newDeck.splice(idx, 1);
      }

      return {
        ...state,
        players: {
          ...state.players,
          [event.player]: {
            ...playerState,
            hand: [...playerState.hand, event.card],
            inPlay: newInPlay,
            inPlaySourceIndices: newInPlaySourceIndices,
            discard: newDiscard,
            deck: newDeck,
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
        winner: event.winner as Player | null,
        log: [
          ...state.log,
          {
            type: "game-over",
            humanVP: event.scores["human"] || event.scores["player0"] || 0,
            aiVP: event.scores["ai"] || event.scores["player1"] || 0,
            winner: (event.winner || "human") as Player,
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

