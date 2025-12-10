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

      if (entry.type === "play-action" && entry.card) {
        const newSummary = {
          ...summary,
          actionsPlayed: [...summary.actionsPlayed, entry.card],
        };
        const newTurnMap = new Map(state.turnMap);
        newTurnMap.set(key, newSummary);
        return { ...state, turnMap: newTurnMap };
      }

      if (entry.type === "play-treasure" && entry.card) {
        const newSummary = {
          ...summary,
          treasuresPlayed: [...summary.treasuresPlayed, entry.card],
        };
        const newTurnMap = new Map(state.turnMap);
        newTurnMap.set(key, newSummary);
        return { ...state, turnMap: newTurnMap };
      }

      if (entry.type === "buy-card" && entry.card) {
        const newSummary = {
          ...summary,
          cardsBought: [...summary.cardsBought, entry.card],
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

/**
 * Builds structured game facts as TOON-encoded data
 */
export function buildStrategicContext(
  state: GameState,
  strategySummary?: string,
  customStrategy?: string,
): string {
  const currentPlayer = state.players[state.activePlayer];
  const opponentId = Object.keys(state.players).find(
    id => id !== state.activePlayer,
  ) as keyof typeof state.players;
  const opponent = state.players[opponentId];

  const currentAllCards = [
    ...currentPlayer.deck,
    ...currentPlayer.hand,
    ...currentPlayer.discard,
    ...currentPlayer.inPlay,
  ];
  const opponentAllCards = [
    ...opponent.deck,
    ...opponent.hand,
    ...opponent.discard,
    ...opponent.inPlay,
  ];

  const currentVP = calculateVP(
    currentPlayer.deck,
    currentPlayer.hand,
    currentPlayer.discard,
    currentPlayer.inPlay,
  );
  const opponentVP = calculateVP(
    opponent.deck,
    opponent.hand,
    opponent.discard,
    opponent.inPlay,
  );

  const provincesLeft = state.supply["Province"] ?? DEFAULT_PROVINCE_COUNT;
  const gameStage: "Early" | "Mid" | "Late" = run(() => {
    if (state.turn <= EARLY_GAME_TURN_THRESHOLD) return "Early";
    if (provincesLeft <= LATE_GAME_PROVINCES_THRESHOLD) return "Late";
    return "Mid";
  });

  const PROVINCE_VP = 6;
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
    const strategies = JSON.parse(strategySummary) as Record<
      string,
      PlayerStrategyAnalysis
    >;
    const aiStrategy = strategies[state.activePlayer];

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
    const current = Object.entries(state.supply)
      .filter(([cardName, count]) => {
        const card = cardName as CardName;
        const cost = CARDS[card]?.cost || 0;
        return count > 0 && cost <= state.coins;
      })
      .map(([cardName]) => ({
        card: cardName,
        cost: CARDS[cardName as CardName]?.cost || 0,
      }));

    const unlocks = treasures
      .map((treasure, idx) => {
        const treasureValue = CARDS[treasure].coins || 0;
        const runningTotal =
          state.coins +
          treasures
            .slice(0, idx + 1)
            .reduce((sum, t) => sum + (CARDS[t].coins || 0), 0);
        const prevTotal =
          idx === 0
            ? state.coins
            : state.coins +
              treasures
                .slice(0, idx)
                .reduce((sum, t) => sum + (CARDS[t].coins || 0), 0);

        const unlocked = Object.entries(state.supply)
          .filter(([cardName, count]) => {
            const cost = CARDS[cardName as CardName]?.cost || 0;
            return count > 0 && cost <= runningTotal && cost > prevTotal;
          })
          .map(([cardName]) => ({
            card: cardName,
            cost: CARDS[cardName as CardName]?.cost || 0,
          }));

        return {
          treasureName: treasure,
          coinValue: treasureValue,
          newCoinTotal: runningTotal,
          cardsUnlocked: unlocked,
        };
      })
      .filter(u => u.cardsUnlocked.length > 0);

    facts.buyableWithCurrentCoins = current;
    facts.whatEachUnplayedTreasureUnlocks = unlocks;
  }

  return encodeToon(facts);
}

const calculateVP = (
  deck: CardName[],
  hand: CardName[],
  discard: CardName[],
  inPlay: CardName[],
): number => countVPFromCards([...deck, ...hand, ...discard, ...inPlay]);

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
