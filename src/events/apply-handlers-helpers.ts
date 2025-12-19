import type { GameState, PlayerState, CardName } from "../types/game-state";
import type { GameEvent } from "./types";
import { removeCard } from "../lib/card-array-utils";
import { run } from "../lib/run";
import { CARDS } from "../data/cards";

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
  const playerState = state.players[event.playerId];
  if (!playerState) return state;
  const newDeck = playerState.deck.slice(0, -1);
  return {
    ...state,
    players: {
      ...state.players,
      [event.playerId]: {
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
        playerId: event.playerId,
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
  const playerState = state.players[event.playerId];
  if (!playerState) return state;
  const handIndex = playerState.hand.indexOf(event.card);
  if (handIndex === -1) return state;
  const newHand = [...playerState.hand];
  newHand.splice(handIndex, 1);

  // Determine action type for turnHistory based on card type
  const cardDef = CARDS[event.card];
  const isTreasure = cardDef?.types.includes("treasure");
  const isAction = cardDef?.types.includes("action");

  const turnHistoryEntry = run(() => {
    if (isTreasure) return { type: "play_treasure" as const, card: event.card };
    if (isAction) return { type: "play_action" as const, card: event.card };
    return null;
  });

  return {
    ...state,
    players: {
      ...state.players,
      [event.playerId]: {
        ...playerState,
        hand: newHand,
        inPlay: [...playerState.inPlay, event.card],
        inPlaySourceIndices: [...playerState.inPlaySourceIndices, handIndex],
      },
    },
    turnHistory: turnHistoryEntry
      ? [...state.turnHistory, turnHistoryEntry]
      : state.turnHistory,
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
  const playerState = state.players[event.playerId];
  if (!playerState) return state;
  const [newInPlay, newInPlaySourceIndices] =
    event.from === "inPlay"
      ? removeCardFromInPlay(
          playerState.inPlay,
          playerState.inPlaySourceIndices,
          event.card,
        )
      : [playerState.inPlay, playerState.inPlaySourceIndices];

  // Track discard decisions from hand (Cellar, Militia response, etc)
  // Don't track end-of-turn cleanup discards
  const shouldTrack =
    event.from === "hand" && event.playerId === state.activePlayerId;
  const turnHistoryEntry = shouldTrack
    ? { type: "discard_card" as const, card: event.card }
    : null;

  return {
    ...state,
    players: {
      ...state.players,
      [event.playerId]: {
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
    turnHistory: turnHistoryEntry
      ? [...state.turnHistory, turnHistoryEntry]
      : state.turnHistory,
    log: [
      ...state.log,
      {
        type: "discard-cards",
        playerId: event.playerId,
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
  const playerState = state.players[event.playerId];
  if (!playerState) return state;
  const [newInPlay, newInPlaySourceIndices] =
    event.from === "inPlay"
      ? removeCardFromInPlay(
          playerState.inPlay,
          playerState.inPlaySourceIndices,
          event.card,
        )
      : [playerState.inPlay, playerState.inPlaySourceIndices];

  // Track trash decisions from hand (Chapel, Mine, etc)
  const shouldTrack = event.from === "hand";
  const turnHistoryEntry = shouldTrack
    ? { type: "trash_card" as const, card: event.card }
    : null;

  return {
    ...state,
    players: {
      ...state.players,
      [event.playerId]: {
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
    turnHistory: turnHistoryEntry
      ? [...state.turnHistory, turnHistoryEntry]
      : state.turnHistory,
    log: [
      ...state.log,
      { type: "trash-card", playerId: event.playerId, card: event.card },
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
  const playerState = state.players[event.playerId];
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

  // Track gain actions in turnHistory:
  // - Buys (buy phase + to discard) -> "buy_card"
  // - Card effect gains (Workshop, Artisan, etc) -> "gain_card"
  const isBuy = state.phase === "buy" && event.to === "discard";
  const newTurnHistory = run(() => {
    if (isBuy)
      return [
        ...state.turnHistory,
        { type: "buy_card" as const, card: event.card },
      ];
    // Track all other gains (Workshop to discard, Artisan to hand, etc)
    return [
      ...state.turnHistory,
      { type: "gain_card" as const, card: event.card },
    ];
  });

  return {
    ...state,
    players: {
      ...state.players,
      [event.playerId]: {
        ...playerState,
        ...updates,
      },
    },
    supply: newSupply,
    turnHistory: newTurnHistory,
    log: [
      ...state.log,
      { type: "gain-card", playerId: event.playerId, card: event.card },
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
    console.log("[DEBUG] CARD_REVEALED:", { playerId: event.playerId, card: event.card, from: event.from });

    // Check if the last log entry is also a reveal from the same player
    const lastLog = state.log[state.log.length - 1];
    const isConsecutiveReveal =
      lastLog?.type === "text" &&
      typeof lastLog.message === "string" &&
      lastLog.message.includes("reveals") &&
      lastLog.message.includes("from");

    if (isConsecutiveReveal && lastLog.message.startsWith(event.playerId)) {
      // Append to existing reveal message (before the "from" part)
      const parts = lastLog.message.split(" from ");
      const updatedMessage = `${parts[0]}, ${event.card} from ${parts[1]}`;
      console.log("[DEBUG] Batching reveal:", updatedMessage);
      return {
        ...state,
        log: [...state.log.slice(0, -1), { type: "text", message: updatedMessage }],
      };
    }

    // First reveal from this player
    const fromLocation = event.from || "deck";
    const message = `${event.playerId} reveals ${event.card} from ${fromLocation}`;
    const newState = {
      ...state,
      log: [
        ...state.log,
        { type: "text", message },
      ],
    };
    console.log("[DEBUG] New reveal entry:", message);
    console.log("[DEBUG] Log now has", newState.log.length, "entries");
    console.log("[DEBUG] Last 3 log entries:", newState.log.slice(-3));
    return newState;
  }

  if (event.type === "CARD_PEEKED") {
    return {
      ...state,
      log: [
        ...state.log,
        { type: "text", message: `${event.playerId} looks at ${event.card}` },
      ],
    };
  }

  if (event.type === "DECK_SHUFFLED") {
    const playerState = state.players[event.playerId];
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
        [event.playerId]: updatedPlayer,
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
    const playerState = state.players[event.playerId];
    if (!playerState) return state;
    return {
      ...state,
      players: {
        ...state.players,
        [event.playerId]: {
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
    const playerState = state.players[event.playerId];
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
        [event.playerId]: {
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
