import type { GameState, CardName } from "../types/game-state";
import type { GameEvent } from "../events/types";
import { peekDraw } from "../cards/effect-types";
import { countVP } from "../lib/game-utils";
import { generateEventId } from "../events/id-generator";
import { CARDS } from "../data/cards";
import {
  getCopperSupplyCount,
  getVictoryCardCount,
  getCurseCardCount,
  getKingdomCardCount,
  TREASURE_SUPPLY,
} from "../data/supply-constants";

/** Create resource modification events with proper ID and causality */
export function createResourceEvents(
  modifications: Array<{
    type: "ACTIONS_MODIFIED" | "BUYS_MODIFIED" | "COINS_MODIFIED";
    delta: number;
  }>,
  causedBy: string,
): GameEvent[] {
  return modifications.map(mod => ({
    ...mod,
    id: generateEventId(),
    causedBy,
  }));
}

export const GAME_CONSTANTS = {
  INITIAL_HAND_SIZE: 5,
  KINGDOM_CARD_SELECTION: 10,
  RANDOM_OFFSET: 0.5,
  EMPTY_PILES_FOR_GAME_OVER: 3,
  TWO_PLAYERS: 2,
  UUID_BASE: 36,
  UUID_SLICE: 2,
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

  // Victory cards: Estate and Duchy follow base count, Province scales for 5-6 players
  supply.Estate = getVictoryCardCount(playerCount, "Estate");
  supply.Duchy = getVictoryCardCount(playerCount, "Duchy");
  supply.Province = getVictoryCardCount(playerCount, "Province");

  // Treasure cards: Copper adjusted for starting decks (7 per player)
  supply.Copper = getCopperSupplyCount(playerCount);
  supply.Silver = TREASURE_SUPPLY.SILVER;
  supply.Gold = TREASURE_SUPPLY.GOLD;

  // Curses: Scale with player count (10 per opponent)
  supply.Curse = getCurseCardCount(playerCount);

  // Kingdom cards: 8 for 2 players, 10 for 3+ players
  // Victory-type kingdom cards (e.g., Gardens) use victory card counts
  const kingdomCardCount = getKingdomCardCount(playerCount);
  const kingdomSupply = kingdomCards.reduce(
    (acc, card) => {
      const cardDef = CARDS[card];
      const isVictoryKingdom = cardDef?.types.includes("victory");
      const count = isVictoryKingdom
        ? getVictoryCardCount(playerCount, "Estate")
        : kingdomCardCount;
      return { ...acc, [card]: count };
    },
    {} as Record<string, number>,
  );

  return { ...supply, ...kingdomSupply };
}

export function getNextPlayer(state: GameState, currentPlayer: string): string {
  const currentIdx = state.playerOrder.indexOf(currentPlayer);
  const nextIdx = (currentIdx + 1) % state.playerOrder.length;
  return state.playerOrder[nextIdx];
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
