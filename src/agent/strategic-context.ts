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

type StrategicFacts = {
  // Core strategic insights (not derivable from raw state)
  gameStage: "Early" | "Mid" | "Late";
  yourVictoryPoints: number;
  opponentVictoryPoints: number;
  yourDeckComposition: Record<string, number>;
  opponentDeckComposition: Record<string, number>;

  // Optional AI memory
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

const DEFAULT_LAST_N_TURNS = 3; // For quick decision-making (per action)
export const STRATEGY_ANALYSIS_TURNS = 7; // For strategy analysis (once per turn)
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
 * Returns TOON-encoded compact turn summaries
 *
 * @param state - Current game state
 * @param format - Output format (toon or json)
 * @param turnCount - Number of turns to include (default 3 for decisions, use 7 for strategy)
 */
export function formatTurnHistoryForAnalysis(
  state: GameState,
  format: "json" | "toon" = "toon",
  turnCount = DEFAULT_LAST_N_TURNS,
): string {
  const recentTurns = extractRecentTurns(state.log, turnCount);

  if (recentTurns.length === 0) {
    return "";
  }

  // Convert to compact format for TOON encoding
  const compactTurns = recentTurns.map(turn => ({
    turn: turn.turn,
    player: turn.player,
    actions: turn.actionsPlayed.length > 0 ? turn.actionsPlayed : null,
    bought: turn.cardsBought.length > 0 ? turn.cardsBought : null,
  }));

  const content =
    format === "toon"
      ? encodeToon(compactTurns)
      : JSON.stringify(compactTurns, null, JSON_INDENT_SPACES);

  return `RECENT TURN HISTORY:\n${content}`;
}

interface PlayerStrategyAnalysis {
  gameplan: string;
  read: string;
  recommendation: string;
}

const EARLY_GAME_TURN_THRESHOLD = 5;
const LATE_GAME_PROVINCES_THRESHOLD = 4;
const DEFAULT_PROVINCE_COUNT = 8;
const JSON_INDENT_SPACES = 2;

const getAllCards = (player: GameState["players"][string]) => [
  ...player.deck,
  ...player.hand,
  ...player.discard,
  ...player.inPlay,
];

const calculateVP = (cards: CardName[]) => countVPFromCards(cards);

/**
 * Builds structured game facts encoded based on format
 * Only includes strategic insights - removes data already present in game state
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

  const yourAnalysis = analyzeDeck(currentAllCards);
  const opponentAnalysis = analyzeDeck(opponentAllCards);

  // Strategic insights only - no derivable stats or duplicates
  const facts: StrategicFacts = {
    gameStage,
    yourVictoryPoints: currentVP,
    opponentVictoryPoints: opponentVP,
    yourDeckComposition: yourAnalysis.counts,
    opponentDeckComposition: opponentAnalysis.counts,
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

  // No buy phase calculations - legal actions already shows buyable cards

  return format === "toon"
    ? encodeToon(facts)
    : JSON.stringify(facts, null, JSON_INDENT_SPACES);
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
