import type { CardName, PlayerState, Player, LogEntry } from "../types/game-state";
import { CARDS } from "../data/cards";

export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

type DrawEvent = { type: 'draw'; cards: CardName[] } | { type: 'shuffle' };

export function drawCards(player: PlayerState, count: number): { player: PlayerState; drawn: CardName[]; events: DrawEvent[] } {
  const drawn: CardName[] = [];
  const events: DrawEvent[] = [];
  let deck = [...player.deck];
  let discard = [...player.discard];
  let hand = [...player.hand];
  let currentBatch: CardName[] = [];

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break;
      // Flush current batch before shuffle
      if (currentBatch.length > 0) {
        events.push({ type: 'draw', cards: currentBatch });
        currentBatch = [];
      }
      deck = shuffle(discard);
      discard = [];
      events.push({ type: 'shuffle' });
    }
    const card = deck.shift()!;
    drawn.push(card);
    hand.push(card);
    currentBatch.push(card);
  }

  // Flush remaining batch
  if (currentBatch.length > 0) {
    events.push({ type: 'draw', cards: currentBatch });
  }

  return {
    player: { ...player, deck, hand, discard, inPlaySourceIndices: player.inPlaySourceIndices, deckTopRevealed: false },
    drawn,
    events,
  };
}

/** Helper to add draw log entries in correct transactional order */
export function logDraw(
  children: LogEntry[],
  drawResult: { events: DrawEvent[] },
  player: Player
): void {
  for (const event of drawResult.events) {
    if (event.type === 'shuffle') {
      children.push({ type: "shuffle-deck", player });
    } else {
      children.push({ type: "draw-cards", player, count: event.cards.length, cards: event.cards });
    }
  }
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
