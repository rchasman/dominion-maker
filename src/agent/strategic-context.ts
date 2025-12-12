import type { GameState, CardName, LogEntry } from "../types/game-state";
import {
  CARDS,
  isActionCard,
  isTreasureCard,
  isVictoryCard,
} from "../data/cards";
import { countVP as countVPFromCards } from "../lib/board-utils";
import { run } from "../lib/run";
import { encodeToon } from "../lib/toon";
import { GAME_CONSTANTS } from "../commands/handle-helpers";

type StrategicFacts = {
  currentTurnNumber: number;
  gameStage: "Early" | "Mid" | "Late";
  yourVictoryPoints: number;
  opponentVictoryPoints: number;
  victoryPointDifference: number;
  provincesYouNeedToWin: number;
  provincesTheyNeedToWin: number;
  yourDeckTotalCards: number;
  yourDeckComposition: Record<string, number>;
  yourTreasureCount: number;
  yourActionCount: number;
  yourVictoryCardCount: number;
  yourTotalTreasureValue: number;
  yourAvgTreasureValue: number;
  yourVillageCount: number;
  yourTerminalCount: number;
  yourDeckCycleTime: number;
  yourDrawPileCount: number;
  yourDiscardPileCount: number;
  shuffleNextTurn: boolean;
  opponentDeckTotalCards: number;
  opponentDeckComposition: Record<string, number>;
  opponentTotalTreasureValue: number;
  opponentAvgTreasureValue: number;
  supplyPiles: Record<string, number>;
  handCards: string[];
  coinsActivatedThisTurn: number;
  coinsInUnplayedTreasures: number;
  maxCoinsIfAllTreasuresPlayed: number;
  unplayedTreasuresInHand: string[];
  buyableWithCurrentCoins?: Array<{ card: string; cost: number }>;
  whatEachUnplayedTreasureUnlocks?: Array<{
    treasureName: string;
    coinValue: number;
    newCoinTotal: number;
    cardsUnlocked: Array<{ card: string; cost: number }>;
  }>;
  aiStrategyGameplan?: string;
  aiStrategyRead?: string;
  aiStrategyRecommendation?: string;
  strategyOverride?: string;
};

/**
 * Extracts recent turn actions from game log for strategy analysis
 */
interface TurnSummary {
  player: string;
  turn: number;
  actionsPlayed: CardName[];
  treasuresPlayed: CardName[];
  cardsBought: CardName[];
}

const DEFAULT_LAST_N_TURNS = 3;
const SUMMARIES_PER_TURN = 2;

function extractRecentTurns(
  log: LogEntry[],
  lastNTurns = DEFAULT_LAST_N_TURNS,
): TurnSummary[] {
  interface TurnState {
    turnMap: Map<string, TurnSummary>;
    currentTurn: number;
    currentPlayer: string;
  }

  const { turnMap } = log.reduce<TurnState>(
    (state, entry) => {
      if (entry.type === "turn-start") {
        const newTurn = entry.turn;
        const newPlayer = entry.player;
        const key = `${newPlayer}-${newTurn}`;
        if (!state.turnMap.has(key)) {
          const newTurnMap = new Map(state.turnMap);
          newTurnMap.set(key, {
            player: newPlayer,
            turn: newTurn,
            actionsPlayed: [],
            treasuresPlayed: [],
            cardsBought: [],
          });
          return {
            ...state,
            turnMap: newTurnMap,
            currentTurn: newTurn,
            currentPlayer: newPlayer,
          };
        }
        return { ...state, currentTurn: newTurn, currentPlayer: newPlayer };
      }

      if (state.currentTurn === 0) return state;

      const player = "player" in entry ? entry.player : state.currentPlayer;
      const key = `${player}-${state.currentTurn}`;
      const summary = state.turnMap.get(key);
      if (!summary) return state;

      const fieldMap = {
        "play-action": "actionsPlayed",
        "play-treasure": "treasuresPlayed",
        "buy-card": "cardsBought",
      } as const;

      const field = fieldMap[entry.type as keyof typeof fieldMap];
      if (field && entry.card) {
        const newSummary = {
          ...summary,
          [field]: [...summary[field], entry.card],
        };
        const newTurnMap = new Map(state.turnMap);
        newTurnMap.set(key, newSummary);
        return { ...state, turnMap: newTurnMap };
      }

      return state;
    },
    {
      turnMap: new Map<string, TurnSummary>(),
      currentTurn: 0,
      currentPlayer: "",
    },
  );

  const allSummaries = Array.from(turnMap.values()).sort(
    (a, b) => b.turn - a.turn,
  );
  return allSummaries.slice(0, lastNTurns * SUMMARIES_PER_TURN);
}

/**
 * Formats turn history for LLM analysis
 */
export function formatTurnHistoryForAnalysis(state: GameState): string {
  const recentTurns = extractRecentTurns(state.log, DEFAULT_LAST_N_TURNS);

  if (recentTurns.length === 0) {
    return "";
  }

  const lines = ["RECENT TURN HISTORY:"].concat(
    recentTurns.flatMap(turn => {
      const actions =
        turn.actionsPlayed.length > 0 ? turn.actionsPlayed.join(", ") : "none";
      const buys =
        turn.cardsBought.length > 0 ? turn.cardsBought.join(", ") : "none";

      return [
        `Turn ${turn.turn} (${turn.player}):`,
        `  Actions played: ${actions}`,
        `  Bought: ${buys}`,
      ];
    }),
  );

  return lines.join("\n");
}

interface PlayerStrategyAnalysis {
  gameplan: string;
  read: string;
  recommendation: string;
}

const EARLY_GAME_TURN_THRESHOLD = 5;
const LATE_GAME_PROVINCES_THRESHOLD = 4;
const DEFAULT_PROVINCE_COUNT = 8;
const PROVINCE_VP = 6;

const getAllCards = (player: GameState["players"][string]) => [
  ...player.deck,
  ...player.hand,
  ...player.discard,
  ...player.inPlay,
];

const calculateVP = (cards: CardName[]) => countVPFromCards(cards);

const filterBuyableCards = (
  supply: GameState["supply"],
  maxCost: number,
  minCost = 0,
) =>
  Object.entries(supply)
    .filter(([cardName, count]) => {
      const cost = CARDS[cardName as CardName]?.cost || 0;
      return count > 0 && cost <= maxCost && cost > minCost;
    })
    .map(([cardName]) => ({
      card: cardName,
      cost: CARDS[cardName as CardName]?.cost || 0,
    }));

/**
 * Builds structured game facts encoded based on format
 */
export function buildStrategicContext(
  state: GameState,
  strategySummary?: string,
  customStrategy?: string,
  format: "json" | "toon" = "toon",
): string {
  const currentPlayer = state.players[state.activePlayer];
  const opponentId = Object.keys(state.players).find(
    id => id !== state.activePlayer,
  ) as keyof typeof state.players;
  const opponent = state.players[opponentId];

  const currentAllCards = getAllCards(currentPlayer);
  const opponentAllCards = getAllCards(opponent);

  const currentVP = calculateVP(currentAllCards);
  const opponentVP = calculateVP(opponentAllCards);

  const provincesLeft = state.supply["Province"] ?? DEFAULT_PROVINCE_COUNT;
  const gameStage: "Early" | "Mid" | "Late" = run(() => {
    if (state.turn <= EARLY_GAME_TURN_THRESHOLD) return "Early";
    if (provincesLeft <= LATE_GAME_PROVINCES_THRESHOLD) return "Late";
    return "Mid";
  });

  const youNeed = Math.ceil((opponentVP + 1 - currentVP) / PROVINCE_VP);
  const theyNeed = Math.ceil((currentVP + 1 - opponentVP) / PROVINCE_VP);

  const yourAnalysis = analyzeDeck(currentAllCards);
  const opponentAnalysis = analyzeDeck(opponentAllCards);

  const treasures = currentPlayer.hand.filter(c => isTreasureCard(c));
  const treasureValue = treasures.reduce(
    (sum, c) => sum + (CARDS[c].coins || 0),
    0,
  );
  const maxCoins = state.coins + treasureValue;

  const facts: StrategicFacts = {
    currentTurnNumber: state.turn,
    gameStage,
    yourVictoryPoints: currentVP,
    opponentVictoryPoints: opponentVP,
    victoryPointDifference: currentVP - opponentVP,
    provincesYouNeedToWin: youNeed,
    provincesTheyNeedToWin: theyNeed,
    yourDeckTotalCards: currentAllCards.length,
    yourDeckComposition: yourAnalysis.counts,
    yourTreasureCount: yourAnalysis.treasures,
    yourActionCount: yourAnalysis.actions,
    yourVictoryCardCount: yourAnalysis.victory,
    yourTotalTreasureValue: yourAnalysis.totalTreasureValue,
    yourAvgTreasureValue: yourAnalysis.avgTreasureValue,
    yourVillageCount: yourAnalysis.villages,
    yourTerminalCount: yourAnalysis.terminals,
    yourDeckCycleTime: parseFloat(
      (currentAllCards.length / GAME_CONSTANTS.INITIAL_HAND_SIZE).toFixed(1),
    ),
    yourDrawPileCount: currentPlayer.deck.length,
    yourDiscardPileCount: currentPlayer.discard.length,
    shuffleNextTurn:
      currentPlayer.deck.length <= GAME_CONSTANTS.INITIAL_HAND_SIZE &&
      currentPlayer.discard.length > 0,
    opponentDeckTotalCards: opponentAllCards.length,
    opponentDeckComposition: opponentAnalysis.counts,
    opponentTotalTreasureValue: opponentAnalysis.totalTreasureValue,
    opponentAvgTreasureValue: opponentAnalysis.avgTreasureValue,
    supplyPiles: state.supply,
    handCards: currentPlayer.hand,
    coinsActivatedThisTurn: state.coins,
    coinsInUnplayedTreasures: treasureValue,
    maxCoinsIfAllTreasuresPlayed: maxCoins,
    unplayedTreasuresInHand: treasures,
  };

  // Add AI's own strategy analysis (not opponent's - no cheating)
  if (strategySummary) {
    const strategies = JSON.parse(strategySummary) as Array<
      PlayerStrategyAnalysis & { id: string }
    >;
    const aiStrategy = strategies.find(s => s.id === state.activePlayer);

    if (aiStrategy) {
      facts.aiStrategyGameplan = aiStrategy.gameplan;
      facts.aiStrategyRead = aiStrategy.read;
      facts.aiStrategyRecommendation = aiStrategy.recommendation;
    }
  }

  // Add custom override
  if (customStrategy?.trim()) {
    facts.strategyOverride = customStrategy.trim();
  }

  // Add buy options if in buy phase
  if (state.phase === "buy") {
    facts.buyableWithCurrentCoins = filterBuyableCards(
      state.supply,
      state.coins,
    );

    const cumulativeTotals = treasures.reduce(
      (totals, t) => [
        ...totals,
        totals[totals.length - 1] + (CARDS[t].coins || 0),
      ],
      [state.coins],
    );

    facts.whatEachUnplayedTreasureUnlocks = treasures
      .map((treasure, idx) => ({
        treasureName: treasure,
        coinValue: CARDS[treasure].coins || 0,
        newCoinTotal: cumulativeTotals[idx + 1],
        cardsUnlocked: filterBuyableCards(
          state.supply,
          cumulativeTotals[idx + 1],
          cumulativeTotals[idx],
        ),
      }))
      .filter(u => u.cardsUnlocked.length > 0);
  }

  return format === "toon" ? encodeToon(facts) : JSON.stringify(facts, null, 2);
}

interface DeckAnalysis {
  treasures: number;
  actions: number;
  victory: number;
  breakdown: string;
  totalTreasureValue: number;
  avgTreasureValue: number;
  terminals: number;
  villages: number;
  counts: Record<string, number>;
}

interface DeckAccumulator {
  counts: Record<string, number>;
  treasureValue: number;
  treasureCount: number;
  terminals: number;
  villages: number;
}

function analyzeDeck(cards: CardName[]): DeckAnalysis {
  const initial: DeckAccumulator = {
    counts: {},
    treasureValue: 0,
    treasureCount: 0,
    terminals: 0,
    villages: 0,
  };
  const { counts, treasureValue, treasureCount, terminals, villages } =
    cards.reduce((acc, card) => {
      const { coins, description } = CARDS[card];
      const newCounts = { ...acc.counts, [card]: (acc.counts[card] || 0) + 1 };
      const hasTreasure = coins
        ? {
            treasureValue: acc.treasureValue + coins,
            treasureCount: acc.treasureCount + 1,
          }
        : {};

      const actionUpdate = run(() => {
        if (!isActionCard(card)) return {};
        if (description.includes("+2 Actions"))
          return { villages: acc.villages + 1 };
        if (!description.includes("+1 Action"))
          return { terminals: acc.terminals + 1 };
        return {};
      });

      return {
        ...acc,
        ...hasTreasure,
        ...actionUpdate,
        counts: newCounts,
      };
    }, initial);

  const breakdown = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([card, count]) => `${count} ${card}`)
    .join(", ");

  return {
    treasures: cards.filter(isTreasureCard).length,
    actions: cards.filter(isActionCard).length,
    victory: cards.filter(isVictoryCard).length,
    breakdown,
    totalTreasureValue: treasureValue,
    avgTreasureValue: treasureCount > 0 ? treasureValue / treasureCount : 0,
    terminals,
    villages,
    counts,
  };
}
