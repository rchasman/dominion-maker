import type { CardName, GameState, PlayerState } from "../types/game-state";
import { FIRST_GAME_KINGDOM, KINGDOM_CARDS } from "../data/cards";

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createStartingDeck(): CardName[] {
  const deck: CardName[] = [
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Copper",
    "Estate",
    "Estate",
    "Estate",
  ];
  return shuffle(deck);
}

function createPlayerState(): PlayerState {
  const deck = createStartingDeck();
  return {
    deck: deck.slice(5),
    hand: deck.slice(0, 5),
    discard: [],
    inPlay: [],
  };
}

function selectKingdomCards(useFirstGame: boolean): CardName[] {
  if (useFirstGame) {
    return FIRST_GAME_KINGDOM;
  }
  return shuffle(KINGDOM_CARDS).slice(0, 10);
}

function createSupply(kingdomCards: CardName[]): Record<CardName, number> {
  const supply: Partial<Record<CardName, number>> = {
    // Base treasures (for 2 players)
    Copper: 46, // 60 - 14 (7 per player)
    Silver: 40,
    Gold: 30,

    // Victory (for 2 players: 8 each)
    Estate: 8,
    Duchy: 8,
    Province: 8,

    // Curse (10 for 2 players)
    Curse: 10,
  };

  // Add kingdom cards (10 each, or 8 for victory cards)
  for (const card of kingdomCards) {
    supply[card] = card === "Gardens" ? 8 : 10;
  }

  return supply as Record<CardName, number>;
}

export function initializeGame(useFirstGame = true): GameState {
  const kingdomCards = selectKingdomCards(useFirstGame);

  return {
    turn: 1,
    phase: "action",
    activePlayer: "human",

    players: {
      human: createPlayerState(),
      ai: createPlayerState(),
    },

    supply: createSupply(kingdomCards),
    trash: [],
    kingdomCards,

    actions: 1,
    buys: 1,
    coins: 0,

    pendingDecision: null,

    gameOver: false,
    winner: null,

    log: ["Game started. Human plays first."],
  };
}

// Helper to draw cards from deck (reshuffling if needed)
export function drawCards(
  player: PlayerState,
  count: number
): { player: PlayerState; drawn: CardName[] } {
  const drawn: CardName[] = [];
  let { deck, hand, discard } = player;

  for (let i = 0; i < count; i++) {
    if (deck.length === 0) {
      if (discard.length === 0) break; // Can't draw
      deck = shuffle(discard);
      discard = [];
    }
    const card = deck.shift()!;
    drawn.push(card);
    hand = [...hand, card];
  }

  return {
    player: { ...player, deck, hand, discard },
    drawn,
  };
}
