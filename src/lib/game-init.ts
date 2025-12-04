import type { CardName, GameState, PlayerState } from "../types/game-state";
import { FIRST_GAME_KINGDOM, KINGDOM_CARDS } from "../data/cards";
import { shuffle } from "./game-utils";

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
    inPlaySourceIndices: [],
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

  const humanPlayer = createPlayerState();
  const aiPlayer = createPlayerState();

  return {
    turn: 1,
    phase: "action",
    subPhase: null,
    activePlayer: "human",

    players: {
      human: humanPlayer,
      ai: aiPlayer,
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

    log: [
      { type: "start-game", player: "human", coppers: 7, estates: 3 },
      {
        type: "turn-start",
        turn: 1,
        player: "human",
        children: [{
          type: "draw-cards",
          player: "human",
          count: humanPlayer.hand.length,
          cards: humanPlayer.hand,
        }],
      },
    ],
    turnHistory: [], // Start with empty turn history
  };
}
