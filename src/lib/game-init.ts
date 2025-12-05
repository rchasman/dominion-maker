import type { CardName, GameState, PlayerState, Player, PlayerInfo, PlayerType } from "../types/game-state";
// GameState type used for casting
import { KINGDOM_CARDS } from "../data/cards";
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

function selectKingdomCards(): CardName[] {
  return shuffle(KINGDOM_CARDS).slice(0, 10);
}

/**
 * Create supply scaled for player count
 * Based on official Dominion rules:
 * - Victory cards: 8 for 2 players, 12 for 3-4 players
 * - Curses: (playerCount - 1) × 10
 * - Copper: 60 - (7 × playerCount)
 */
function createSupply(kingdomCards: CardName[], playerCount: number = 2): Record<CardName, number> {
  const victoryCount = playerCount <= 2 ? 8 : 12;
  const curseCount = (playerCount - 1) * 10;
  const copperCount = 60 - (7 * playerCount);

  const supply: Partial<Record<CardName, number>> = {
    // Base treasures
    Copper: copperCount,
    Silver: 40,
    Gold: 30,

    // Victory cards
    Estate: victoryCount,
    Duchy: victoryCount,
    Province: victoryCount,

    // Curses
    Curse: curseCount,
  };

  // Add kingdom cards (10 each, or scaled for victory cards like Gardens)
  for (const card of kingdomCards) {
    supply[card] = card === "Gardens" ? victoryCount : 10;
  }

  return supply as Record<CardName, number>;
}

export function initializeGame(): GameState {
  const kingdomCards = selectKingdomCards();

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

/**
 * Player info for multiplayer game initialization
 */
interface MultiplayerPlayerConfig {
  id: string;
  name: string;
  type: PlayerType;
}

/**
 * Initialize a multiplayer game with N players (2-4)
 */
export function initializeMultiplayerGame(
  playerConfigs: MultiplayerPlayerConfig[],
  options?: {
    kingdomCards?: CardName[];
  }
): GameState {
  const playerCount = playerConfigs.length;
  if (playerCount < 2 || playerCount > 4) {
    throw new Error(`Invalid player count: ${playerCount}. Must be 2-4.`);
  }

  const kingdomCards = options?.kingdomCards ?? selectKingdomCards();

  // Create player order (player0, player1, etc.)
  const playerOrder: Player[] = playerConfigs.map((_, i) => `player${i}` as Player);

  // Create player states
  const players: Partial<Record<Player, PlayerState>> = {};
  const playerInfo: Partial<Record<Player, PlayerInfo>> = {};

  for (let i = 0; i < playerCount; i++) {
    const playerId = `player${i}` as Player;
    const config = playerConfigs[i];

    players[playerId] = createPlayerState();
    playerInfo[playerId] = {
      id: config.id,
      name: config.name,
      type: config.type,
      connected: config.type === "human",
    };
  }

  const firstPlayer = playerOrder[0];
  const firstPlayerState = players[firstPlayer]!;

  return {
    turn: 1,
    phase: "action",
    subPhase: null,
    activePlayer: firstPlayer,

    players,

    supply: createSupply(kingdomCards, playerCount),
    trash: [],
    kingdomCards,

    actions: 1,
    buys: 1,
    coins: 0,

    pendingDecision: null,

    gameOver: false,
    winner: null,

    log: [
      { type: "start-game", player: firstPlayer, coppers: 7, estates: 3 },
      {
        type: "turn-start",
        turn: 1,
        player: firstPlayer,
        children: [{
          type: "draw-cards",
          player: firstPlayer,
          count: firstPlayerState.hand.length,
          cards: firstPlayerState.hand,
        }],
      },
    ],
    turnHistory: [],

    // Multiplayer-specific fields
    playerOrder,
    // Cast to satisfy TypeScript - runtime only has the active player keys
    playerInfo: playerInfo as GameState["playerInfo"],
    isMultiplayer: true,
  };
}
