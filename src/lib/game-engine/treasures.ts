import type { CardName, GameState } from "../../types/game-state";
import { CARDS, isTreasureCard } from "../../data/cards";

export function playTreasure(state: GameState, card: CardName, originalIndex?: number, reasoning?: string): GameState {
  const player = state.activePlayer;
  const playerState = state.players[player];

  const cardIndex = playerState.hand.indexOf(card);
  if (cardIndex === -1 || !isTreasureCard(card)) return state;

  const newHand = [...playerState.hand];
  newHand.splice(cardIndex, 1);

  const coinValue = CARDS[card].coins ?? 0;
  const sourceIndex = originalIndex ?? cardIndex;

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        hand: newHand,
        inPlay: [...playerState.inPlay, card],
        inPlaySourceIndices: [...playerState.inPlaySourceIndices, sourceIndex],
      },
    },
    coins: state.coins + coinValue,
    log: [...state.log, {
      type: "play-treasure",
      player,
      card,
      coins: coinValue,
      reasoning,
    }],
  };
}

export function unplayTreasure(state: GameState, card: CardName): GameState {
  if (state.phase !== "buy") return state;

  const player = state.activePlayer;
  const playerState = state.players[player];

  const cardIndex = playerState.inPlay.indexOf(card);
  if (cardIndex === -1 || !isTreasureCard(card)) return state;

  const coinValue = CARDS[card].coins ?? 0;
  if (state.coins < coinValue) return state; // Can't unplay if coins already spent

  const newInPlay = [...playerState.inPlay];
  newInPlay.splice(cardIndex, 1);

  const newSourceIndices = [...playerState.inPlaySourceIndices];
  const originalHandIndex = newSourceIndices[cardIndex];
  newSourceIndices.splice(cardIndex, 1);

  // Insert card back at original position (clamped to current hand length)
  const newHand = [...playerState.hand];
  const insertAt = Math.min(originalHandIndex, newHand.length);
  newHand.splice(insertAt, 0, card);

  return {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerState,
        hand: newHand,
        inPlay: newInPlay,
        inPlaySourceIndices: newSourceIndices,
      },
    },
    coins: state.coins - coinValue,
    log: [...state.log, {
      type: "unplay-treasure",
      player,
      card,
      coins: coinValue,
    }],
  };
}

export function hasTreasuresInHand(state: GameState): boolean {
  const hand = state.players[state.activePlayer].hand;
  return hand.some(isTreasureCard);
}

export function playAllTreasures(state: GameState): GameState {
  let current = state;
  const player = state.activePlayer;
  const hand = state.players[player].hand;

  // Pre-calculate original indices before any cards are played
  const treasureIndices: { card: CardName; originalIndex: number }[] = [];
  for (let i = 0; i < hand.length; i++) {
    if (isTreasureCard(hand[i])) {
      treasureIndices.push({ card: hand[i], originalIndex: i });
    }
  }

  // Play each treasure with individual log entries
  for (const { card, originalIndex } of treasureIndices) {
    const playerState = current.players[player];
    const cardIndex = playerState.hand.indexOf(card);
    if (cardIndex === -1 || !isTreasureCard(card)) continue;

    const newHand = [...playerState.hand];
    newHand.splice(cardIndex, 1);

    const coinValue = CARDS[card].coins ?? 0;
    const sourceIndex = originalIndex;

    current = {
      ...current,
      players: {
        ...current.players,
        [player]: {
          ...playerState,
          hand: newHand,
          inPlay: [...playerState.inPlay, card],
          inPlaySourceIndices: [...playerState.inPlaySourceIndices, sourceIndex],
        },
      },
      coins: current.coins + coinValue,
      log: [...current.log, {
        type: "play-treasure",
        player,
        card,
        coins: coinValue,
      }],
    };
  }

  return current;
}
