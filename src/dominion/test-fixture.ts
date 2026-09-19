import { DominionEngine } from "../engine";
import { KINGDOM_CARDS } from "../data/cards";
import type { CardName } from "../types/game-state";
import type { GameEvent } from "../events/types";

const DEFAULT_DECK: CardName[] = [
  "Silver",
  "Gold",
  "Copper",
  "Estate",
  "Copper",
];
const BOB_DECK: CardName[] = [
  "Copper",
  "Copper",
  "Estate",
  "Estate",
  "Gold",
  "Silver",
  "Estate",
];

/** Alice and Bob with exact hands; alice is the active player on turn 1 */
export function fixture(
  hand: CardName[],
  options: { deck?: CardName[]; bobHand?: CardName[] } = {},
): DominionEngine {
  const engine = new DominionEngine();
  engine.startGame(["alice", "bob"], KINGDOM_CARDS, 42);
  const deck = options.deck ?? DEFAULT_DECK;
  const bobHand = options.bobHand ?? BOB_DECK.slice(0, 5);
  const setup: GameEvent[] = [
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "alice",
      cards: [...deck, ...hand],
    },
    { type: "INITIAL_HAND_DRAWN", playerId: "alice", cards: hand },
    {
      type: "INITIAL_DECK_DEALT",
      playerId: "bob",
      cards: [...BOB_DECK.slice(5), ...bobHand],
    },
    { type: "INITIAL_HAND_DRAWN", playerId: "bob", cards: bobHand },
  ];
  engine.applyExternalEvents(setup);
  return engine;
}
