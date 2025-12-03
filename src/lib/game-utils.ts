import type { CardName, PlayerState } from "../types/game-state";
import { CARDS } from "../data/cards";

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawCards(player: PlayerState, count: number): { player: PlayerState; drawn: CardName[] } {
  const drawn: CardName[] = [];
  let deck = [...player.deck];
  let discard = [...player.discard];
  let hand = [...player.hand];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
    }
    const card = deck.shift()!;
    drawn.push(card);
    hand.push(card);
  }

  return {
    player: { ...player, deck, hand, discard, inPlaySourceIndices: player.inPlaySourceIndices },
    drawn,
  };
}

export function countVP(player: PlayerState): number {
  const allCards = [...player.deck, ...player.hand, ...player.discard, ...player.inPlay];
  let vp = 0;

  for (const card of allCards) {
    const def = CARDS[card];
    if (def.vp === "variable") {
      // Gardens: 1 VP per 10 cards
      vp += Math.floor(allCards.length / 10);
    } else if (typeof def.vp === "number") {
      vp += def.vp;
    }
  }

  return vp;
}
