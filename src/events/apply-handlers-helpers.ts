import type { GameState, PlayerState, CardName } from "../types/game-state";
import type { GameEvent } from "./types";
import { removeCard } from "../lib/card-array-utils";
import { run } from "../lib/run";

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
 * Apply CARD_DRAWN event
 */
export function applyCardDrawn(
  state: GameState,
  event: GameEvent,
): GameState | null {
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
export function applyCardPlayed(
  state: GameState,
  event: GameEvent,
): GameState | null {
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
export function applyCardDiscarded(
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
export function applyCardTrashed(
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
export function applyCardGained(
  state: GameState,
  event: GameEvent,
): GameState | null {
  if (event.type !== "CARD_GAINED") return null;
  const playerState = state.players[event.player];
  if (!playerState) return state;

  // Silently ignore if supply is empty (centralized supply depletion check)
  const currentSupply = state.supply[event.card] || 0;
  if (currentSupply <= 0) return state;

  const newSupply = {
    ...state.supply,
    [event.card]: currentSupply - 1,
  };
  const updates: Partial<PlayerState> = run(() => {
    if (event.to === "hand") return { hand: [...playerState.hand, event.card] };
    if (event.to === "discard")
      return { discard: [...playerState.discard, event.card] };
    if (event.to === "deck") return { deck: [...playerState.deck, event.card] };
    return {};
  });
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
export function applyRevealAndShuffle(
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

  if (event.type === "CARD_PEEKED") {
    return {
      ...state,
      log: [
        ...state.log,
        { type: "text", message: `${event.player} looks at ${event.card}` },
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
export function applyCardReposition(
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
