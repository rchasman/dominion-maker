import type { GameState, PlayerState, CardName } from "../types/game-state";
import type { GameEvent } from "./types";
import { removeCard } from "../lib/card-array-utils";

/**
 * Helper: Remove a card from inPlay zone along with its source index.
 */
export const removeCardFromInPlay = (
  inPlay: CardName[],
  indices: number[],
  card: CardName,
): [CardName[], number[]] => {
  const idx = inPlay.indexOf(card);
  return idx === -1
    ? [inPlay, indices]
    : [
        [...inPlay.slice(0, idx), ...inPlay.slice(idx + 1)],
        [...indices.slice(0, idx), ...indices.slice(idx + 1)],
      ];
};

/**
 * Apply turn structure events
 */
export function applyTurnEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "TURN_STARTED") {
    return {
      ...state,
      turn: event.turn,
      activePlayer: event.player,
      phase: "action",
      actions: 0,
      buys: 0,
      coins: 0,
      turnHistory: [],
      log: [
        ...state.log,
        { type: "turn-start", turn: event.turn, player: event.player },
      ],
    };
  }

  if (event.type === "TURN_ENDED") {
    return state;
  }

  if (event.type === "PHASE_CHANGED") {
    return {
      ...state,
      phase: event.phase,
      log: [
        ...state.log,
        {
          type: "phase-change",
          player: state.activePlayer,
          phase: event.phase,
        },
      ],
    };
  }

  return null;
}

/**
 * Apply CARD_DRAWN event
 */
function applyCardDrawn(state: GameState, event: GameEvent): GameState | null {
  if (event.type !== "CARD_DRAWN") return null;
  const playerState = state.players[event.player];
  if (!playerState) return state;
  const newDeck = playerState.deck.slice(0, -1);
  return {
    ...state,
    players: {
      ...state.players,
      [event.player]: {
        ...playerState,
        deck: newDeck,
        hand: [...playerState.hand, event.card],
        deckTopRevealed: false,
      },
    },
    log: [
      ...state.log,
      {
        type: "draw-cards",
        player: event.player,
        count: 1,
        cards: [event.card],
      },
    ],
  };
}

/**
 * Apply CARD_PLAYED event
 */
function applyCardPlayed(state: GameState, event: GameEvent): GameState | null {
  if (event.type !== "CARD_PLAYED") return null;
  const playerState = state.players[event.player];
  if (!playerState) return state;
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

/**
 * Apply CARD_DISCARDED event
 */
function applyCardDiscarded(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type !== "CARD_DISCARDED") return null;
  const playerState = state.players[event.player];
  if (!playerState) return state;
  const [newInPlay, newInPlaySourceIndices] =
    event.from === "inPlay"
      ? removeCardFromInPlay(
          playerState.inPlay,
          playerState.inPlaySourceIndices,
          event.card,
        )
      : [playerState.inPlay, playerState.inPlaySourceIndices];
  return {
    ...state,
    players: {
      ...state.players,
      [event.player]: {
        ...playerState,
        hand:
          event.from === "hand"
            ? removeCard(playerState.hand, event.card)
            : playerState.hand,
        inPlay: newInPlay,
        inPlaySourceIndices: newInPlaySourceIndices,
        deck:
          event.from === "deck"
            ? removeCard(playerState.deck, event.card, true)
            : playerState.deck,
        discard: [...playerState.discard, event.card],
      },
    },
    log: [
      ...state.log,
      {
        type: "discard-cards",
        player: event.player,
        count: 1,
        cards: [event.card],
      },
    ],
  };
}

/**
 * Apply CARD_TRASHED event
 */
function applyCardTrashed(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type !== "CARD_TRASHED") return null;
  const playerState = state.players[event.player];
  if (!playerState) return state;
  const [newInPlay, newInPlaySourceIndices] =
    event.from === "inPlay"
      ? removeCardFromInPlay(
          playerState.inPlay,
          playerState.inPlaySourceIndices,
          event.card,
        )
      : [playerState.inPlay, playerState.inPlaySourceIndices];
  return {
    ...state,
    players: {
      ...state.players,
      [event.player]: {
        ...playerState,
        hand:
          event.from === "hand"
            ? removeCard(playerState.hand, event.card)
            : playerState.hand,
        deck:
          event.from === "deck"
            ? removeCard(playerState.deck, event.card, true)
            : playerState.deck,
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

/**
 * Apply CARD_GAINED event
 */
function applyCardGained(state: GameState, event: GameEvent): GameState | null {
  if (event.type !== "CARD_GAINED") return null;
  const playerState = state.players[event.player];
  if (!playerState) return state;
  const newSupply = {
    ...state.supply,
    [event.card]: (state.supply[event.card] || 0) - 1,
  };
  let updates: Partial<PlayerState> = {};
  if (event.to === "hand") {
    updates = { hand: [...playerState.hand, event.card] };
  } else if (event.to === "discard") {
    updates = { discard: [...playerState.discard, event.card] };
  } else if (event.to === "deck") {
    updates = { deck: [...playerState.deck, event.card] };
  }
  const newTurnHistory =
    event.to === "discard"
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

/**
 * Apply CARD_REVEALED and DECK_SHUFFLED events
 */
function applyRevealAndShuffle(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "CARD_REVEALED") {
    return {
      ...state,
      log: [
        ...state.log,
        { type: "text", message: `${event.player} reveals ${event.card}` },
      ],
    };
  }

  if (event.type === "DECK_SHUFFLED") {
    const playerState = state.players[event.player];
    if (!playerState) return state;
    const updatedPlayer: PlayerState = {
      ...playerState,
      deck: event.newDeckOrder ?? [],
      discard: [],
      deckTopRevealed: false,
    };
    return {
      ...state,
      players: {
        ...state.players,
        [event.player]: updatedPlayer,
      },
    };
  }

  return null;
}

/**
 * Apply CARD_PUT_ON_DECK and CARD_RETURNED_TO_HAND events
 */
function applyCardReposition(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "CARD_PUT_ON_DECK") {
    const playerState = state.players[event.player];
    if (!playerState) return state;
    return {
      ...state,
      players: {
        ...state.players,
        [event.player]: {
          ...playerState,
          hand:
            event.from === "hand"
              ? removeCard(playerState.hand, event.card)
              : playerState.hand,
          discard:
            event.from === "discard"
              ? removeCard(playerState.discard, event.card)
              : playerState.discard,
          deck: [...playerState.deck, event.card],
          deckTopRevealed: true,
        },
      },
    };
  }

  if (event.type === "CARD_RETURNED_TO_HAND") {
    const playerState = state.players[event.player];
    if (!playerState) return state;
    const [newInPlay, newInPlaySourceIndices] =
      event.from === "inPlay"
        ? removeCardFromInPlay(
            playerState.inPlay,
            playerState.inPlaySourceIndices,
            event.card,
          )
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
          discard:
            event.from === "discard"
              ? removeCard(playerState.discard, event.card)
              : playerState.discard,
          deck:
            event.from === "deck"
              ? removeCard(playerState.deck, event.card, true)
              : playerState.deck,
        },
      },
    };
  }

  return null;
}

/**
 * Apply card movement events
 */
export function applyCardMovementEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  const drawnResult = applyCardDrawn(state, event);
  if (drawnResult) return drawnResult;

  const playedResult = applyCardPlayed(state, event);
  if (playedResult) return playedResult;

  const discardedResult = applyCardDiscarded(state, event);
  if (discardedResult) return discardedResult;

  const trashedResult = applyCardTrashed(state, event);
  if (trashedResult) return trashedResult;

  const gainedResult = applyCardGained(state, event);
  if (gainedResult) return gainedResult;

  const revealResult = applyRevealAndShuffle(state, event);
  if (revealResult) return revealResult;

  return applyCardReposition(state, event);
}

/**
 * Apply resource modification events
 */
export function applyResourceEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "ACTIONS_MODIFIED") {
    const newActions = Math.max(0, state.actions + event.delta);
    const logEntry =
      event.delta > 0
        ? {
            type: "get-actions" as const,
            player: state.activePlayer,
            count: event.delta,
          }
        : null;
    return {
      ...state,
      actions: newActions,
      log: logEntry ? [...state.log, logEntry] : state.log,
    };
  }

  if (event.type === "BUYS_MODIFIED") {
    const newBuys = Math.max(0, state.buys + event.delta);
    const logEntry =
      event.delta > 0
        ? {
            type: "get-buys" as const,
            player: state.activePlayer,
            count: event.delta,
          }
        : null;
    return {
      ...state,
      buys: newBuys,
      log: logEntry ? [...state.log, logEntry] : state.log,
    };
  }

  if (event.type === "COINS_MODIFIED") {
    const newCoins = Math.max(0, state.coins + event.delta);
    const logEntry =
      event.delta > 0
        ? {
            type: "get-coins" as const,
            player: state.activePlayer,
            count: event.delta,
          }
        : null;
    return {
      ...state,
      coins: newCoins,
      log: logEntry ? [...state.log, logEntry] : state.log,
    };
  }

  return null;
}

/**
 * Apply decision events
 */
export function applyDecisionEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "DECISION_REQUIRED") {
    const decision = event.decision;
    return {
      ...state,
      subPhase:
        decision.player !== state.activePlayer ? "opponent_decision" : null,
      pendingDecision: decision,
    };
  }

  if (event.type === "DECISION_RESOLVED") {
    return {
      ...state,
      pendingDecision: null,
      subPhase: null,
    };
  }

  return null;
}

/**
 * Apply game end events
 */
export function applyGameEndEvent(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type === "GAME_ENDED") {
    return {
      ...state,
      gameOver: true,
      winner: event.winner,
      log: [
        ...state.log,
        {
          type: "game-over",
          scores: event.scores,
          winner: event.winner || state.activePlayer,
        },
      ],
    };
  }

  return null;
}
