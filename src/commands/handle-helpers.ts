import type { GameState, CardName } from "../types/game-state";
import type { GameEvent } from "../events/types";
import { peekDraw } from "../cards/effect-types";
import { countVP } from "../lib/game-utils";
import { generateEventId } from "../events/id-generator";

export const GAME_CONSTANTS = {
  INITIAL_HAND_SIZE: 5,
  KINGDOM_CARD_SELECTION: 10,
  RANDOM_OFFSET: 0.5,
  EMPTY_PILES_FOR_GAME_OVER: 3,
  TWO_PLAYERS: 2,
  UUID_BASE: 36,
  UUID_SLICE: 2,
} as const;

export const SUPPLY_CONSTANTS = {
  COPPER_BASE: 60,
  COPPER_PER_PLAYER: 7,
  SILVER_COUNT: 40,
  GOLD_COUNT: 30,
  CURSE_PER_OPPONENT: 10,
  KINGDOM_CARD_COUNT: 10,
  VICTORY_CARD_COUNT_2P: 8,
  VICTORY_CARD_COUNT_3P_PLUS: 12,
} as const;

export function selectRandomKingdomCards(): CardName[] {
  const allKingdom: CardName[] = [
    "Cellar",
    "Chapel",
    "Moat",
    "Harbinger",
    "Merchant",
    "Vassal",
    "Village",
    "Workshop",
    "Bureaucrat",
    "Gardens",
    "Militia",
    "Moneylender",
    "Poacher",
    "Remodel",
    "Smithy",
    "Throne Room",
    "Bandit",
    "Council Room",
    "Festival",
    "Laboratory",
    "Library",
    "Market",
    "Mine",
    "Sentry",
    "Witch",
    "Artisan",
  ];

  // Simple shuffle for now (could use seeded RNG)
  const shuffled = [...allKingdom].sort(
    () => Math.random() - GAME_CONSTANTS.RANDOM_OFFSET,
  );
  return shuffled.slice(0, GAME_CONSTANTS.KINGDOM_CARD_SELECTION);
}

export function calculateSupply(
  playerCount: number,
  kingdomCards: CardName[],
): Record<string, number> {
  const supply: Record<string, number> = {};

  // Victory cards scale with player count
  const victoryCount =
    playerCount <= GAME_CONSTANTS.TWO_PLAYERS
      ? SUPPLY_CONSTANTS.VICTORY_CARD_COUNT_2P
      : SUPPLY_CONSTANTS.VICTORY_CARD_COUNT_3P_PLUS;

  supply.Estate = victoryCount;
  supply.Duchy = victoryCount;
  supply.Province = victoryCount;

  // Treasure cards
  supply.Copper =
    SUPPLY_CONSTANTS.COPPER_BASE -
    playerCount * SUPPLY_CONSTANTS.COPPER_PER_PLAYER;
  supply.Silver = SUPPLY_CONSTANTS.SILVER_COUNT;
  supply.Gold = SUPPLY_CONSTANTS.GOLD_COUNT;

  // Curses scale with player count
  supply.Curse = (playerCount - 1) * SUPPLY_CONSTANTS.CURSE_PER_OPPONENT;

  // Kingdom cards (10 each)
  const kingdomSupply = kingdomCards.reduce(
    (acc, card) => ({
      ...acc,
      [card]:
        card === "Gardens" ? victoryCount : SUPPLY_CONSTANTS.KINGDOM_CARD_COUNT,
    }),
    {} as Record<string, number>,
  );

  return { ...supply, ...kingdomSupply };
}

export function createDrawEventsForCleanup(
  state: GameState,
  player: string,
  count: number,
  causedBy?: string,
): GameEvent[] {
  const playerState = state.players[player];
  if (!playerState) return [];

  const { cards, shuffled, newDeckOrder, cardsBeforeShuffle } = peekDraw(
    playerState,
    count,
  );

  const createDrawEvent = (card: CardName): GameEvent => ({
    type: "CARD_DRAWN",
    player,
    card,
    id: generateEventId(),
    causedBy,
  });

  if (shuffled && cardsBeforeShuffle) {
    // Draw cards before shuffle
    const beforeShuffleEvents = cardsBeforeShuffle.map(createDrawEvent);

    // Then shuffle
    const shuffleEvent: GameEvent = {
      type: "DECK_SHUFFLED",
      player,
      newDeckOrder,
      id: generateEventId(),
      causedBy,
    };

    // Then draw remaining cards after shuffle
    const cardsAfterShuffle = cards.slice(cardsBeforeShuffle.length);
    const afterShuffleEvents = cardsAfterShuffle.map(createDrawEvent);

    return [...beforeShuffleEvents, shuffleEvent, ...afterShuffleEvents];
  }
  // No shuffle, just draw all cards
  return cards.map(createDrawEvent);
}

export function getNextPlayer(
  state: GameState,
  currentPlayer: string,
): string {
  const playerOrder = state.playerOrder || ["human", "ai"];
  const currentIdx = playerOrder.indexOf(currentPlayer);
  const nextIdx = (currentIdx + 1) % playerOrder.length;
  return playerOrder[nextIdx];
}

export function checkGameOver(state: GameState): GameEvent | null {
  // Province pile empty
  if ((state.supply.Province || 0) <= 0) {
    return createGameOverEvent(state, "provinces_empty");
  }

  // Three piles empty
  const emptyPiles = Object.values(state.supply).filter(
    count => count <= 0,
  ).length;
  if (emptyPiles >= GAME_CONSTANTS.EMPTY_PILES_FOR_GAME_OVER) {
    return createGameOverEvent(state, "three_piles_empty");
  }

  return null;
}

function createGameOverEvent(
  state: GameState,
  reason: "provinces_empty" | "three_piles_empty",
): GameEvent {
  type ScoreAccumulator = {
    scores: Record<string, number>;
    winner: string | null;
    maxScore: number;
  };
  const initialAcc: ScoreAccumulator = {
    scores: {},
    winner: null,
    maxScore: -Infinity,
  };
  const { scores, winner } = Object.entries(state.players)
    .filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
      Boolean(entry[1]),
    )
    .reduce((acc, [playerId, playerState]) => {
      const score = countVP(playerState);
      const newScores = { ...acc.scores, [playerId]: score };
      const newWinner = score > acc.maxScore ? playerId : acc.winner;
      const newMaxScore = Math.max(acc.maxScore, score);
      return { scores: newScores, winner: newWinner, maxScore: newMaxScore };
    }, initialAcc);

  return {
    type: "GAME_ENDED",
    winner,
    scores,
    reason,
  };
}
